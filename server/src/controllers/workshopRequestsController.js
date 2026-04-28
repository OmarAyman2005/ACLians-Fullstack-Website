import mongoose from 'mongoose';
import WorkshopRequest from '../models/WorkshopRequests.js';
import { Workshop } from '../models/Workshop.js';
import User from '../models/User.js';
import { createWorkshopRequestSchema, updateWorkshopRequestSchema } from '../validators/workshopRequestsValidation.js';
import Joi from 'joi';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const listWorkshopRequests = async (req, res) => {
  try {
    const { workshop, status, createdBy, name, faculty, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const filter = {};

    // preserve provided id filters if valid
    if (workshop && isObjectId(workshop)) filter.workshop = workshop;
    if (status) filter.status = status;
    if (createdBy && isObjectId(createdBy)) filter.createdBy = createdBy;

    const skip = (Number(page) - 1) * Number(limit);

    // If client asked to filter by workshop name or faculty, resolve matching workshop ids first
    if (name || faculty) {
      const workshopFilter = { eventType: 'workshop' };
      if (name) {
        // partial, case-insensitive match on workshop name
        workshopFilter.name = { $regex: name, $options: 'i' };
      }
      if (faculty) {
        workshopFilter.faculty = faculty;
      }

      const matchingWorkshops = await Workshop.find(workshopFilter).select('_id').lean();
      const ids = matchingWorkshops.map((w) => String(w._id));

      // if no workshops match, return empty page
      if (ids.length === 0) {
        return res.json({
          status: 'success',
          page: Number(page),
          pages: 0,
          total: 0,
          count: 0,
          data: [],
        });
      }

      // If client already specified a specific workshop id, ensure it is among the matched ids
      if (filter.workshop) {
        if (!ids.includes(String(filter.workshop))) {
          return res.json({
            status: 'success',
            page: Number(page),
            pages: 0,
            total: 0,
            count: 0,
            data: [],
          });
        }
        // keep filter.workshop as-is (single id)
      } else {
        // restrict requests to the matched workshop ids
        filter.workshop = { $in: ids };
      }
    }

    const [items, total] = await Promise.all([
      WorkshopRequest.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('workshop')
        .populate('createdBy', 'fullName email')
        .populate('modifiedBy', 'fullName email'),
      WorkshopRequest.countDocuments(filter),
    ]);

    res.json({
      status: 'success',
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
      count: items.length,
      data: items,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getWorkshopRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id.' });

    const reqDoc = await WorkshopRequest.findById(id)
      .populate('workshop')
      .populate('createdBy', 'fullName email')
      .populate('modifiedBy', 'fullName email');

    if (!reqDoc) return res.status(404).json({ status: 'error', message: 'Workshop request not found.' });

    res.json({ status: 'success', data: reqDoc });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const createWorkshopRequest = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (req.user?.id) payload.createdBy = req.user.id;

    await createWorkshopRequestSchema.validateAsync(payload, { abortEarly: false });

    if (!isObjectId(payload.workshop)) return res.status(400).json({ status: 'error', message: 'Invalid workshop id.' });
    const workshopExists = await Workshop.findById(payload.workshop);
    if (!workshopExists) return res.status(404).json({ status: 'error', message: 'Workshop not found.' });

    if (!isObjectId(payload.createdBy)) return res.status(400).json({ status: 'error', message: 'Invalid createdBy id.' });
    const creator = await User.findById(payload.createdBy);
    if (!creator) return res.status(400).json({ status: 'error', message: 'createdBy user not found.' });

    const doc = new WorkshopRequest(payload);
    const saved = await doc.save();

    res.status(201).json({ status: 'success', data: saved });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ status: 'error', message: err.details.map(d => d.message).join('; ') });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const changeWorkshopRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };

    // if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    // if (req.user?.id) payload.modifiedBy = req.user.id;
    payload.modifiedBy = "68dfbbe5fdfbeca20099e4d5";

    await updateWorkshopRequestSchema.validateAsync(payload, { abortEarly: false });

    if (!isObjectId(payload.modifiedBy)) return res.status(400).json({ status: 'error', message: 'Invalid modifiedBy id.' });
    const modifier = await User.findById(payload.modifiedBy);
    if (!modifier) return res.status(400).json({ status: 'error', message: 'modifiedBy user not found.' });

    const updated = await WorkshopRequest.findByIdAndUpdate(
      id,
      { status: payload.status, comment: payload.comment, modifiedBy: payload.modifiedBy, modifiedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('workshop').populate('createdBy', 'fullName email').populate('modifiedBy', 'fullName email');

    if (!updated) return res.status(404).json({ status: 'error', message: 'Workshop request not found.' });

    // also update the referenced Workshop's status:
    try {
      const workshopRef = updated.workshop;
      const workshopId = workshopRef && (workshopRef._id || workshopRef.id || workshopRef);
      if (workshopId && isObjectId(workshopId)) {
        const newWorkshopStatus = String(payload.status) === "accepted" ? "Accepted" : "Pending";
        await Workshop.findByIdAndUpdate(
          workshopId,
          { status: newWorkshopStatus, modifiedAt: new Date(), modifiedBy: payload.modifiedBy },
          { new: true, runValidators: true }
        );
      }
    } catch (wErr) {
      // Log but do not fail the main request update if workshop update fails
      console.error("Failed to update workshop status after request status change:", wErr);
    }

    res.json({ status: 'success', data: updated });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ status: 'error', message: err.details.map(d => d.message).join('; ') });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const editWorkshopRequestComment = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    // if (req.user?.id) payload.modifiedBy = req.user.id;
    payload.modifiedBy = "68dfbbe5fdfbeca20099e4d5";

    const schema = Joi.object({
      comment: Joi.string().max(1000).allow('').required(),
      modifiedBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    });

    await schema.validateAsync(payload, { abortEarly: false });

    if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    if (!isObjectId(payload.modifiedBy)) return res.status(400).json({ status: 'error', message: 'Invalid modifiedBy id.' });

    const modifier = await User.findById(payload.modifiedBy);
    if (!modifier) return res.status(400).json({ status: 'error', message: 'modifiedBy user not found.' });

    const updated = await WorkshopRequest.findByIdAndUpdate(
      id,
      { comment: payload.comment, modifiedBy: payload.modifiedBy, modifiedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('workshop').populate('createdBy', 'fullName email').populate('modifiedBy', 'fullName email');

    if (!updated) return res.status(404).json({ status: 'error', message: 'Workshop request not found.' });

    res.json({ status: 'success', data: updated });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ status: 'error', message: err.details.map(d => d.message).join('; ') });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const deleteWorkshopRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid id.' });

    const deleted = await WorkshopRequest.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ status: 'error', message: 'Workshop request not found.' });

    res.status(200).json({ status: 'success', message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
import { Workshop } from '../models/Workshop.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import mongoose from 'mongoose';
import WorkshopRequest from '../models/WorkshopRequests.js';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const getAllWorkshops = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'workshop';
    
    const workshops = await Workshop.find(filter)
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);
    
    const total = await Workshop.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalWorkshops: total,
      count: workshops.length,
      data: workshops,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getWorkshopById = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      return res.status(404).json({
        status: 'error',
        message: 'Workshop not found.',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: workshop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getWorkshopsByProfessor = async (req, res) => {
  try {
    const { professorId } = req.params;
    if (!isObjectId(professorId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid professor id.' });
    }

    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'workshop';

    filter.$or = [{ professors: professorId }, { createdBy: professorId }];

    const workshops = await Workshop.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const total = await Workshop.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalWorkshops: total,
      count: workshops.length,
      data: workshops,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createWorkshop = async (req, res) => {
  try {
    if (!req.user?.id || !isObjectId(req.user.id)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required to create a workshop.' });
    }
    const createdBy = req.user?.id;

    req.body.eventType = 'workshop';
    req.body.status = 'Pending';

    const workshop = new Workshop({
      ...req.body,
      createdBy,
      modifiedBy: createdBy,
    });

    const savedWorkshop = await workshop.save();

    try {
      const wr = new WorkshopRequest({
        workshop: savedWorkshop._id,
        createdBy,
      });
      await wr.save();
    } catch (reqErr) {
      await Workshop.findByIdAndDelete(savedWorkshop._id).catch(() => {});
      throw new Error('Failed to create workshop request: ' + (reqErr.message || reqErr));
    }

    res.status(201).json({
      status: 'success',
      message: 'Workshop created successfully.',
      data: savedWorkshop,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const updateWorkshop = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);

    if (!workshop) {
      return res.status(404).json({
        status: 'error',
        message: 'Workshop not found.',
      });
    }

    if (Date.now() >= new Date(workshop.startDateTime)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update a workshop that has already started.',
      });
    }

    const updatePayload = { ...req.body, modifiedAt: new Date() };
    if (req.user?.id && isObjectId(req.user.id)) {
      updatePayload.modifiedBy = req.user.id;
    }

    const updatedWorkshop = await Workshop.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Workshop updated successfully.',
      data: updatedWorkshop,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// ADDED: change status API for a workshop
export const changeWorkshopStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid workshop id.' });
    }

    const allowed = ['Accepted', 'Pending'];
    if (!status || !allowed.includes(String(status))) {
      return res.status(400).json({ status: 'error', message: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    // authorization: require admin or event office (adjust roles per your app)
    const role = req.user?.role;
    if (!req.user || !role || !['admin', 'event_office'].includes(String(role))) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permissions' });
    }

    const workshop = await Workshop.findById(id);
    if (!workshop) {
      return res.status(404).json({ status: 'error', message: 'Workshop not found.' });
    }

    // optional: do not allow changing status after start (adjust as needed)
    if (Date.now() >= new Date(workshop.startDateTime)) {
      return res.status(400).json({ status: 'error', message: 'Cannot change status of a workshop that has already started.' });
    }

    if (String(workshop.status) === String(status)) {
      return res.status(200).json({ status: 'success', message: `Workshop already ${status}`, data: workshop });
    }

    workshop.status = status;
    workshop.modifiedAt = new Date();
    if (req.user?.id && isObjectId(req.user.id)) workshop.modifiedBy = req.user.id;

    const saved = await workshop.save();

    res.status(200).json({ status: 'success', message: `Workshop status updated to ${status}`, data: saved });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message || 'Failed to change workshop status' });
  }
};
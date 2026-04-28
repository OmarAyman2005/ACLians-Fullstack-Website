import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import WorkshopRequest from '../models/WorkshopRequests.js'; // ADDED
import { EventRegister } from "../models/EventRegister.js";

export const getAllEvents = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);

    const [events, total] = await Promise.all([
      Event.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit),
      Event.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalEvents: total,
      count: events.length,
      data: events,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event id' });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }

    return res.status(200).json({ status: 'success', data: event });
  } catch (error) {
    console.error('Error fetching event:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch event', details: error.message });
  }
};

export const createEvent = async (req, res) => {
  try {
    // pick only fields we allow to be set on create
    const {
      name,
      startDateTime,
      endDateTime,
      location,
      description,
      registrationDeadline,
      eventType,
    } = req.body || {};

    // minimal presence checks (schema will also validate)
    if (!name || !startDateTime || !endDateTime || !location || !description || !registrationDeadline || !eventType) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }

    // createdBy comes from auth middleware if available; fall back to body (optional)
    const createdBy =
      (req.user && (req.user.id || req.user._id)) ||
      req.body?.createdBy ||
      null;

    if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
      return res.status(400).json({ status: 'error', message: 'createdBy is required and must be a valid user id' });
    }

    const event = await Event.create({
      name,
      startDateTime,
      endDateTime,
      location,
      description,
      registrationDeadline,
      eventType,
      createdBy,
      // modifiedBy is omitted on create; you can set later on update
    });

    return res.status(201).json({ status: 'success', data: event });
  } catch (error) {
    // Mongoose schema pre('validate') will throw for bad date ordering
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event id' });
    }

    // prevent deletion if there are registrations for this event
    try {
      const regCount = await EventRegister.countDocuments({ event: id });
      if (regCount > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Cannot delete event: there are registrations for this event',
        });
      }
    } catch (countErr) {
      console.error('Failed to check registrations for event deletion:', countErr);
      // proceed conservatively by blocking deletion if we cannot verify; return error
      return res.status(500).json({
        status: 'error',
        message: 'Failed to verify event registrations before deletion',
      });
    }

    // prevent deletion if there are registrations for this event
    try {
      const regCount = await EventRegister.countDocuments({ event: id });
      if (regCount > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Cannot delete event: there are registrations for this event',
        });
      }
    } catch (countErr) {
      console.error('Failed to check registrations for event deletion:', countErr);
      // proceed conservatively by blocking deletion if we cannot verify; return error
      return res.status(500).json({
        status: 'error',
        message: 'Failed to verify event registrations before deletion',
      });
    }

    // Delete the event itself
    const event = await Event.findByIdAndDelete(id);
    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }

    // 🔹 1) Delete related EventApplications
    try {
      const appsDeleted = await EventApplication.deleteMany({ eventId: event._id });
      console.log(`Deleted ${appsDeleted.deletedCount} event applications for event ${event._id}`);
    } catch (appErr) {
      console.error('Failed to delete associated event applications:', appErr);
    }

    // 🔹 2) If event is a workshop, delete WorkshopRequests too
    try {
      if (event.eventType === 'workshop' || (event.type && String(event.type).toLowerCase() === 'workshop')) {
        const wrDeleted = await WorkshopRequest.deleteMany({ workshop: event._id });
        console.log(`Deleted ${wrDeleted.deletedCount} workshop requests for event ${event._id}`);
      }
    } catch (cleanupErr) {
      console.error('Failed to delete associated workshop requests:', cleanupErr);
    }

    return res.status(200).json({
      status: 'success',
      message: `Event '${event.name}' and all related applications deleted successfully.`,
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to delete event', details: error.message });
  }
};
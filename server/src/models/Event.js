import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        startDateTime: { type: Date, required: true },
        endDateTime: { type: Date, required: true },
        location: { type: String, required: true },
        description: { type: String, required: true },
        registrationDeadline: { type: Date, required: true },
        eventType: { type: String, enum: ['workshop', 'trip', 'bazaar', 'booth', 'conference'], required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'modifiedAt' }
    }
);

eventSchema.pre('validate', function (next) {
    if (this.startDateTime && this.endDateTime && this.startDateTime > this.endDateTime) {
        return next(new Error('Start date must be before end date.'));
    }
    if (this.registrationDeadline && this.startDateTime && this.registrationDeadline > this.startDateTime) {
        return next(new Error('Registration deadline must be before the workshop start date.'));
    }
    next();
});

export const Event = mongoose.model('Event', eventSchema);
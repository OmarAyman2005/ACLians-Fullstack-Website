import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

export const ROLES = ['student','staff','ta','professor','vendor','admin','event_office'];
const NEEDS_APPROVAL = new Set(['staff','ta','professor']);

const IdPattern = /^\d{2}-\d{4}$/;

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role:     { type: String, enum: ROLES, default: 'student' },

  // Unique IDs
  studentId: {
    type: String,
    trim: true,
    unique: true,   // <— unique across collection
    sparse: true,   // <— only enforced when the field exists
    validate: {
      validator: v => !v || IdPattern.test(v),
      message: 'studentId must be in format xx-xxxx'
    }
  },
  staffId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    validate: {
      validator: v => !v || IdPattern.test(v),
      message: 'staffId must be in format xx-xxxx'
    }
  },

  status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },

  approvalStatus: {
    type: String,
    enum: ['pending','approved','rejected'],
    default: function () { return NEEDS_APPROVAL.has(this.role) ? 'pending' : 'approved'; }
  },
  isEmailVerified: {
    type: Boolean,
    default: function () { return NEEDS_APPROVAL.has(this.role) ? false : true; }
  },

  isVerified: { type: Boolean, default: true },
}, { timestamps: true });

// Explicit indexes (safe even with the unique/sparse flags above)
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });
userSchema.index({ staffId: 1 },   { unique: true, sparse: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);

import { validationResult } from 'express-validator';
import User, { ROLES } from '../models/User.js';
import VerificationToken from '../models/VerificationToken.js';
import { issueJwt } from '../middleware/auth.js';

const NEEDS_ADMIN_APPROVAL = new Set(['staff','ta','professor']);

// ✅ allow @guc.edu.eg and any subdomain like @student.guc.edu.eg
const GUC_EMAIL_RE = /^[^@\s]+@(?:[A-Za-z0-9-]+\.)*guc\.edu\.eg$/i;
const isGucEmail = (email) => GUC_EMAIL_RE.test(String(email || '').trim());

const isEmailVerified = (user) =>
  (typeof user.isEmailVerified === 'boolean' ? user.isEmailVerified : user.isVerified) === true;

const isIdValid = (v) => /^\d{2}-\d{4}$/.test(String(v || ''));

/* REGISTER */
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let { fullName = '', email = '', password = '', role } = req.body;

    // accept studentId / staffId in multiple key styles
    const studentIdRaw = req.body.studentId ?? req.body.studentID ?? req.body.student_id;
    const staffIdRaw   = req.body.staffId   ?? req.body.staffID   ?? req.body.staff_id;

    email = String(email).trim().toLowerCase();
    fullName = String(fullName).trim();
    let studentId = studentIdRaw ? String(studentIdRaw).trim() : '';
    let staffId   = staffIdRaw   ? String(staffIdRaw).trim()   : '';

    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!fullName) return res.status(400).json({ message: 'Name is required' });

    // ✅ non-vendors must use a guc.edu.eg (or subdomain) email
    if (role !== 'vendor' && !isGucEmail(email)) {
      return res.status(400).json({ message: 'Use your @guc.edu.eg email (subdomains allowed).' });
    }

    // Role ↔ ID validation + uniqueness pre-checks
    if (role === 'student') {
      if (!isIdValid(studentId)) return res.status(400).json({ message: 'Student ID must match xx-xxxx.' });
      // uniqueness pre-check for clearer error
      if (await User.exists({ studentId })) {
        return res.status(409).json({ message: 'Student ID already exists' });
      }
      staffId = undefined;
    } else if (['staff','ta','professor'].includes(role)) {
      if (!isIdValid(staffId)) return res.status(400).json({ message: 'Staff ID must match xx-xxxx.' });
      if (await User.exists({ staffId })) {
        return res.status(409).json({ message: 'Staff ID already exists' });
      }
      studentId = undefined;
    } else {
      studentId = undefined;
      staffId = undefined;
    }

    // email uniqueness (index also enforces; this gives a friendly message)
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already exists' });

    const needsApproval = NEEDS_ADMIN_APPROVAL.has(role);

    await User.create({
      fullName,
      email,
      password,
      role,
      studentId,
      staffId,
      approvalStatus: needsApproval ? 'pending' : 'approved',
      status: 'active',
      isEmailVerified: needsApproval ? false : true,
      isVerified: needsApproval ? false : true,
    });

    if (needsApproval) {
      return res.status(201).json({
        message: 'Registered. Awaiting admin approval.',
        needsApproval: true,
        needsVerification: false
      });
    }

    return res.status(201).json({
      message: 'Registered',
      needsApproval: false,
      needsVerification: false
    });
  } catch (err) {
    // Map duplicate key errors to friendly messages (race-condition safe)
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || '';
      if (key === 'studentId') return res.status(409).json({ message: 'Student ID already exists' });
      if (key === 'staffId')   return res.status(409).json({ message: 'Staff ID already exists' });
      if (key === 'email')     return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('[auth.register] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* LOGIN */
export const login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = String(req.body.email || '').toLowerCase();

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account has been blocked by an admin.' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    if (user.approvalStatus && user.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Your account is awaiting admin approval.' });
    }
    if (!isEmailVerified(user)) {
      return res.status(403).json({ message: 'Please verify your email to continue.' });
    }

    issueJwt(res, user);
    return res.json({
      message: 'Logged in',
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        studentId: user.studentId,
        staffId: user.staffId,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('[auth.login] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* LOGOUT */
export const logout = async (_req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ message: 'Logged out' });
};

/* VERIFY EMAIL */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Missing token' });

    const doc = await VerificationToken.findOne({ token }).populate('user');
    if (!doc) return res.status(400).json({ message: 'Invalid or expired token' });

    doc.user.isEmailVerified = true;
    doc.user.isVerified = true;
    await doc.user.save();
    await VerificationToken.deleteMany({ user: doc.user._id });

    return res.json({ message: 'Email verified' });
  } catch (err) {
    console.error('[auth.verifyEmail] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* ME (cookie-based) */
export const me = async (req, res) => {
  // req.user is set by authRequired (reads and verifies the cookie JWT)
  const u = req.user;
  return res.json({
    ok: true,
    user: {
      id:         u._id,
      fullName:   u.fullName,
      email:      u.email,
      role:       u.role,
      studentId:  u.studentId ?? null,
      staffId:    u.staffId ?? null,
      status:     u.status,
      approvalStatus: u.approvalStatus,
      isEmailVerified: typeof u.isEmailVerified === 'boolean' ? u.isEmailVerified : u.isVerified,
      createdAt:  u.createdAt,
      updatedAt:  u.updatedAt,
    },
  });
};


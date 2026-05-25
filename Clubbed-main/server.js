const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clubbed';

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('[SYS] Connected to MongoDB successfully');
    await initializeDatabase();
  })
  .catch((err) => {
    console.error('[SYS] MongoDB connection failed:', err);
    process.exit(1);
  });

// ======== Schemas & Models ========
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'president', 'admin'],
    default: 'user'
  },
  course: { type: String },
  year: { type: String },
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  createdAt: { type: Date, default: Date.now }
});

const clubSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  tagline: { type: String },
  logoUrl: { type: String },
  about: { type: String },
  contactEmail: { type: String },
  socialLinks: { type: Map, of: String },
  presidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  coreTeam: [
    {
      name: { type: String },
      domain: { type: String }
    }
  ],
  mediaReels: [{ type: String }],
  photoGallery: [{ type: String }],
  achievements: [{ type: mongoose.Schema.Types.Mixed }],
  eventRecords: [{ type: mongoose.Schema.Types.Mixed }],
  dashboardContent: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  hostClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  description: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
  imageUrl: { type: String },
  priceTier: { type: String },
  status: { type: String, enum: ['upcoming', 'past'] },
  registrationLink: { type: String }
});

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String },
  hostClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  type: { type: String, enum: ['volunteer', 'recruitment', 'general'] },
  dateInfo: { type: String },
  applyLink: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  capacity: { type: Number },
  features: [{ type: String }],
  isActive: { type: Boolean, default: true }
});

const bookingSchema = new mongoose.Schema({
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  bookedByPresidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  associatedEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  bookingDate: { type: Date, required: true },
  timeSlotIndex: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'confirmed'],
    default: 'pending'
  }
});

const User = mongoose.model('User', userSchema);
const Club = mongoose.model('Club', clubSchema);
const Event = mongoose.model('Event', eventSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Venue = mongoose.model('Venue', venueSchema);
const Booking = mongoose.model('Booking', bookingSchema);

async function initializeDatabase() {
  try {
    const adminExists = await User.findOne({ username: 'superadmin' });
    let chiptechClub = await Club.findOne({ name: 'Chiptech' });
    if (!chiptechClub) {
      chiptechClub = await Club.create({ name: 'Chiptech' });
    }

    const hashedPassword = await bcrypt.hash('password123', 10);

    if (!adminExists) {
      await User.create({
        username: 'superadmin',
        password: hashedPassword,
        role: 'admin'
      });

      const presidentUser = await User.create({
        username: 'chiptech_prez',
        password: hashedPassword,
        role: 'president',
        clubId: chiptechClub._id
      });

      await User.create({
        username: 'testuser',
        password: hashedPassword,
        course: 'BTech',
        year: '2',
        role: 'user'
      });

      chiptechClub.presidentId = presidentUser._id;
      await chiptechClub.save();
      console.log('Database initialized with default test accounts');
      return;
    }

    // Keep existing environments stable but self-heal test users needed for login.
    let presidentUser = await User.findOne({ username: 'chiptech_prez' });
    if (!presidentUser) {
      presidentUser = await User.create({
        username: 'chiptech_prez',
        password: hashedPassword,
        role: 'president',
        clubId: chiptechClub._id
      });
    }

    if (!presidentUser.clubId || presidentUser.clubId.toString() !== chiptechClub._id.toString()) {
      presidentUser.clubId = chiptechClub._id;
      await presidentUser.save();
    }

    const testUser = await User.findOne({ username: 'testuser' });
    if (!testUser) {
      await User.create({
        username: 'testuser',
        password: hashedPassword,
        course: 'BTech',
        year: '2',
        role: 'user'
      });
    }

    if (!chiptechClub.presidentId || chiptechClub.presidentId.toString() !== presidentUser._id.toString()) {
      chiptechClub.presidentId = presidentUser._id;
      await chiptechClub.save();
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// ============ USER SIGNUP ============
app.post('/api/user/signup', async (req, res) => {
  try {
    const { username, course, year, password, confirm_password } = req.body;

    if (!username || !course || !year || !password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.warn(`[WARN] Signup Conflict: Username ${username} already exists`);
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      course,
      year,
      password: hashedPassword,
      role: 'user'
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      userId: newUser._id
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============ USER LOGIN ============
app.post('/api/user/login', async (req, res) => {
  try {
    const { username, course, year, password } = req.body;

    if (!username || !course || !year || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const user = await User.findOne({ username, course, year, role: 'user' });
    if (!user) {
      console.warn(`[AUTH][WARN] Invalid credentials attempt for username: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.warn(`[AUTH][WARN] Invalid credentials attempt for username: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log(`[AUTH] User login successful - Username: ${username}, Role: user`);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        course: user.course,
        year: user.year,
        role: user.role,
        type: 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============ ADMIN LOGIN ============
app.post('/api/admin/login', async (req, res) => {
  try {
    const { admin_username, admin_password } = req.body;

    if (!admin_username || !admin_password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const admin = await User.findOne({
      username: admin_username,
      role: 'admin'
    }).populate('clubId');

    if (!admin) {
      console.warn(`[AUTH][WARN] Invalid credentials attempt for username: ${admin_username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    const passwordMatch = await bcrypt.compare(admin_password, admin.password);
    if (!passwordMatch) {
      console.warn(`[AUTH][WARN] Invalid credentials attempt for username: ${admin_username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    console.log(`[AUTH] Admin login successful - Username: ${admin_username}, Role: admin`);
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        clubId: admin.clubId ? admin.clubId._id : null,
        clubName: admin.clubId ? admin.clubId.name : null,
        type: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============ PRESIDENT LOGIN ============
app.post('/api/president/login', async (req, res) => {
  try {
    const { president_username, president_password, club } = req.body;

    if (!president_username || !president_password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const president = await User.findOne({
      username: president_username,
      role: 'president'
    }).populate('clubId');

    if (!president) {
      console.warn(`[AUTH][WARN] Invalid credentials attempt for username: ${president_username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid president credentials'
      });
    }

    const requestedClub = typeof club === 'string' ? club.trim().toLowerCase() : '';
    const presidentClubName = president.clubId && president.clubId.name
      ? president.clubId.name.trim().toLowerCase()
      : '';

    if (requestedClub && presidentClubName !== requestedClub) {
      console.warn(`[SECURITY][WARN] President ${president_username} attempted to log into wrong club: ${requestedClub}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid president credentials'
      });
    }

    const passwordMatch = await bcrypt.compare(president_password, president.password);
    if (!passwordMatch) {
      console.warn(`[AUTH][WARN] Invalid credentials attempt for username: ${president_username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid president credentials'
      });
    }

    console.log(`[AUTH] President login successful - Username: ${president_username}, Role: president`);
    return res.status(200).json({
      success: true,
      message: 'President login successful',
      president: {
        id: president._id,
        username: president.username,
        role: president.role,
        clubId: president.clubId ? president.clubId._id : null,
        clubName: president.clubId ? president.clubId.name : null,
        type: 'president'
      }
    });
  } catch (error) {
    console.error('President login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============ ADMIN/PRESIDENT SIGNUP (Optional helper route) ============
app.post('/api/admin/signup', async (req, res) => {
  try {
    const { admin_username, admin_password, role, club } = req.body;

    if (!admin_username || !admin_password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password and role are required'
      });
    }

    if (!['admin', 'president'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be admin or president'
      });
    }

    if (admin_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existing = await User.findOne({ username: admin_username });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }

    let clubDoc = null;
    if (club) {
      clubDoc = await Club.findOne({ name: club });
    }

    const hashedPassword = await bcrypt.hash(admin_password, 10);
    const created = await User.create({
      username: admin_username,
      password: hashedPassword,
      role,
      clubId: clubDoc ? clubDoc._id : undefined
    });

    return res.status(201).json({
      success: true,
      message: `${role} account created successfully`,
      userId: created._id
    });
  } catch (error) {
    console.error('Admin signup error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============ BOOKING ROUTES ============
app.post('/api/bookings', async (req, res) => {
  try {
    const { userId, venueName, bookingDate, timeSlotIndex, clubName } = req.body;

    if (!userId || !venueName || !bookingDate || timeSlotIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'userId, venueName, bookingDate and timeSlotIndex are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const requester = await User.findById(userId).populate('clubId');
    if (!requester || !['president', 'admin'].includes(requester.role)) {
      console.warn(`[AUTH] Unauthorized access attempt - User tried to create booking without required role`);
      return res.status(403).json({
        success: false,
        message: 'Only presidents or admins can create bookings'
      });
    }

    const isAdmin = requester.role === 'admin';
    const targetStatus = isAdmin ? 'confirmed' : 'pending';

    let bookingClubId = requester.clubId ? requester.clubId._id : null;
    if (!bookingClubId && isAdmin) {
      let bookingClub = null;
      if (clubName && typeof clubName === 'string') {
        bookingClub = await Club.findOne({ name: clubName.trim() });
      }
      if (!bookingClub) {
        bookingClub = await Club.findOne({ name: 'Chiptech' });
      }
      if (!bookingClub) {
        bookingClub = await Club.create({ name: 'Chiptech' });
      }
      bookingClubId = bookingClub._id;
    }

    if (!bookingClubId) {
      return res.status(400).json({
        success: false,
        message: 'Requester is not linked to any club'
      });
    }

    let venue = await Venue.findOne({ name: venueName });
    if (!venue) {
      venue = await Venue.create({ name: venueName, isActive: true });
    }

    const normalizedDate = new Date(bookingDate);
    if (Number.isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid bookingDate' });
    }

    const existingOccupied = await Booking.findOne({
      venueId: venue._id,
      bookingDate: normalizedDate,
      timeSlotIndex,
      status: { $in: ['pending', 'approved', 'confirmed'] }
    });

    if (existingOccupied) {
      console.warn(`[WARN] Booking Conflict: Venue ${venueName} is already occupied for this slot`);
      return res.status(409).json({
        success: false,
        message: 'This slot is already booked or waiting for approval'
      });
    }

    const booking = await Booking.create({
      venueId: venue._id,
      clubId: bookingClubId,
      bookedByPresidentId: requester.role === 'president' ? requester._id : undefined,
      bookingDate: normalizedDate,
      timeSlotIndex,
      status: targetStatus
    });

    console.log(`[ACTION] Booking requested - User ID: ${userId}, Venue Name: ${venueName}`);
    return res.status(201).json({
      success: true,
      message: isAdmin ? 'Booking confirmed successfully.' : 'Booking requested. Pending Admin approval.',
      bookingId: booking._id
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/bookings/pending', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const adminUser = await User.findById(userId);
    if (!adminUser || adminUser.role !== 'admin') {
      console.warn(`[AUTH] Unauthorized access attempt - User tried to view pending bookings without admin role`);
      return res.status(403).json({ success: false, message: 'Only admins can view pending bookings' });
    }

    const bookings = await Booking.find({ status: 'pending' })
      .populate('venueId', 'name')
      .populate('clubId', 'name')
      .populate('bookedByPresidentId', 'username')
      .sort({ bookingDate: 1, timeSlotIndex: 1 });

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error('Fetch pending bookings error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/bookings/slots', async (req, res) => {
  try {
    const { userId, venueName, bookingDate } = req.query;

    if (!userId || !venueName || !bookingDate) {
      return res.status(400).json({
        success: false,
        message: 'userId, venueName and bookingDate are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const viewer = await User.findById(userId);
    if (!viewer || !['admin', 'president'].includes(viewer.role)) {
      console.warn(`[AUTH] Unauthorized access attempt - User tried to view booking slots without required role`);
      return res.status(403).json({
        success: false,
        message: 'Only admins or presidents can view booked slots'
      });
    }

    const venue = await Venue.findOne({ name: venueName });
    if (!venue) {
      return res.status(200).json({ success: true, bookings: [] });
    }

    const normalizedDate = new Date(bookingDate);
    if (Number.isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid bookingDate' });
    }

    const bookings = await Booking.find({
      venueId: venue._id,
      bookingDate: normalizedDate,
      status: { $in: ['pending', 'approved', 'confirmed'] }
    })
      .select('timeSlotIndex status')
      .sort({ timeSlotIndex: 1 });

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error('Fetch booking slots error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ success: false, message: 'userId and status are required' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected' });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid booking id' });
    }

    const adminUser = await User.findById(userId);
    if (!adminUser || adminUser.role !== 'admin') {
      console.warn(`[AUTH] Unauthorized access attempt - User tried to update booking status without admin role`);
      return res.status(403).json({ success: false, message: 'Only admins can update booking status' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    console.log(`[AUDIT] Booking status changed - Booking ID: ${id}, New Status: ${status}`);
    return res.status(200).json({ success: true, message: `Booking ${status} successfully` });
  } catch (error) {
    console.error('Update booking status error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/clubs/:clubName/content', async (req, res) => {
  try {
    const { clubName } = req.params;
    const { userId, sectionTitle, headline, description } = req.body;

    if (!userId || !clubName || !sectionTitle) {
      return res.status(400).json({
        success: false,
        message: 'userId, clubName and sectionTitle are required'
      });
    }

    const requester = await User.findById(userId).populate('clubId');
    if (!requester || !['admin', 'president'].includes(requester.role)) {
      console.warn(`[AUTH] Unauthorized access attempt - User tried to update club content without required role`);
      return res.status(403).json({
        success: false,
        message: 'Only admins or presidents can update club content'
      });
    }

    const normalizeClubName = (value = '') =>
      value
        .toLowerCase()
        .replace(/\.rvu\b/g, '')
        .replace(/[^a-z0-9]/g, '');

    let club = null;
    if (requester.role === 'president') {
      if (!requester.clubId) {
        return res.status(403).json({
          success: false,
          message: 'President is not linked to any club'
        });
      }

      club = await Club.findById(requester.clubId._id || requester.clubId);
      if (!club) {
        return res.status(403).json({
          success: false,
          message: 'President club not found'
        });
      }

      // Security check: Ensure president can only update their own club
      const requestedClubNormalized = normalizeClubName(clubName);
      const presidentClubNormalized = normalizeClubName(club.name);

      if (requestedClubNormalized !== presidentClubNormalized) {
        console.warn(`[SECURITY][CRITICAL] Unauthorized Club Update Attempt: President ${requester.username} tried to modify club ${clubName}`);
        return res.status(403).json({
          success: false,
          message: 'You can only update your own club'
        });
      }
    } else {
      const requestedClub = normalizeClubName(clubName);
      const allClubs = await Club.find({});
      club = allClubs.find((item) => normalizeClubName(item.name) === requestedClub);

      if (!club) {
        club = await Club.create({ name: clubName });
      }
    }

    if (!club.dashboardContent || typeof club.dashboardContent.set !== 'function') {
      club.dashboardContent = new Map(Object.entries(club.dashboardContent || {}));
    }

    const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    club.dashboardContent.set(sectionKey, {
      sectionTitle,
      headline: headline || '',
      description: description || '',
      updatedAt: new Date(),
      updatedBy: requester._id
    });

    await club.save();

    return res.status(200).json({
      success: true,
      message: 'Club content updated successfully',
      content: club.dashboardContent.get(sectionKey)
    });
  } catch (error) {
    console.error('Update club content error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// Serve homepage on root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Keep references to avoid no-unused-vars style warnings in some setups.
void Event;
void Announcement;
void Venue;
void Booking;

// Start server
app.listen(PORT, () => {
  console.log(`[SYS] Server is running on http://localhost:${PORT}`);
  console.log(`[SYS] API endpoints available at http://localhost:${PORT}/api`);
});

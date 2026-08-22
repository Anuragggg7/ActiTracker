import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config();

import User from '../models/User.js';
import Department from '../models/Department.js';
import Venue from '../models/Venue.js';
import Activity from '../models/Activity.js';
import SlotRequest from '../models/SlotRequest.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import ActivityReport from '../models/ActivityReport.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

import { connectDB } from '../config/db.js';

export const seedDatabase = async (auto = false) => {
  try {
    if (!auto) {
      await connectDB();
      console.log('[Seed] Database connection established');
    }

    // Clear existing collections
    await User.deleteMany({});
    await Department.deleteMany({});
    await Venue.deleteMany({});
    await Activity.deleteMany({});
    await SlotRequest.deleteMany({});
    await Media.deleteMany({});
    await Document.deleteMany({});
    await ActivityReport.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('[Seed] Cleared database');

    const defaultPasswordHash = await bcrypt.hash('Rcpit@123', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@rcpit2026', 10);

    // 1. Create Academic Departments
    const deptList = [
      { name: 'Artificial Intelligence & Machine Learning', code: 'AIML' },
      { name: 'Artificial Intelligence & Data Science', code: 'AIDS' },
      { name: 'Computer Engineering', code: 'CE' },
      { name: 'Information Technology', code: 'IT' },
      { name: 'Mechanical Engineering', code: 'ME' },
      { name: 'Civil Engineering', code: 'CIVIL' },
      { name: 'Electrical Engineering', code: 'EE' },
      { name: 'Electronics & Telecommunication', code: 'EXTC' },
      { name: 'Training & Placement Cell', code: 'TP' }
    ];

    const createdDepts = {};
    for (const d of deptList) {
      const deptDoc = await Department.create(d);
      createdDepts[d.code] = deptDoc;
    }
    console.log('[Seed] Created Academic Departments');

    // 2. Create Single System Admin
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin@rcpit.ac.in',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      employeeId: 'ADM-001',
      designation: 'System Administrator',
      status: 'APPROVED',
      isSystemAdmin: true
    });

    // 3. Create Director
    const directorUser = await User.create({
      name: 'Dr. J. B. Patil',
      email: 'director@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'DIRECTOR',
      employeeId: 'DIR-001',
      designation: 'Director, RCPIT',
      status: 'APPROVED'
    });

    // 4. Create T&P Cell Officer
    const tpUser = await User.create({
      name: 'Prof. P. H. Jain',
      email: 'tp@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'TP',
      departmentId: createdDepts['TP']._id,
      employeeId: 'TP-001',
      designation: 'Head, Training & Placement',
      status: 'APPROVED'
    });

    // 5. Create HODs for Departments & Link to Departments
    const aimlHod = await User.create({
      name: 'Dr. S. B. Patel',
      email: 'hod.aiml@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'HOD',
      departmentId: createdDepts['AIML']._id,
      employeeId: 'HOD-AIML-01',
      designation: 'Head of Department (AIML)',
      status: 'APPROVED'
    });
    createdDepts['AIML'].hodId = aimlHod._id;
    await createdDepts['AIML'].save();

    const ceHod = await User.create({
      name: 'Dr. V. S. Patel',
      email: 'hod.ce@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'HOD',
      departmentId: createdDepts['CE']._id,
      employeeId: 'HOD-CE-01',
      designation: 'Head of Department (CE)',
      status: 'APPROVED'
    });
    createdDepts['CE'].hodId = ceHod._id;
    await createdDepts['CE'].save();

    const itHod = await User.create({
      name: 'Dr. D. N. Chaudhari',
      email: 'hod.it@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'HOD',
      departmentId: createdDepts['IT']._id,
      employeeId: 'HOD-IT-01',
      designation: 'Head of Department (IT)',
      status: 'APPROVED'
    });
    createdDepts['IT'].hodId = itHod._id;
    await createdDepts['IT'].save();

    const aidsHod = await User.create({
      name: 'Dr. P. V. Ramaiah',
      email: 'hod.aids@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'HOD',
      departmentId: createdDepts['AIDS']._id,
      employeeId: 'HOD-AIDS-01',
      designation: 'Head of Department (AIDS)',
      status: 'APPROVED'
    });
    createdDepts['AIDS'].hodId = aidsHod._id;
    await createdDepts['AIDS'].save();

    // 6. Create Approved Faculty Members
    const faculty1 = await User.create({
      name: 'Prof. Rahul Patil',
      email: 'rahul.patil@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'FACULTY',
      departmentId: createdDepts['AIML']._id,
      employeeId: 'FAC-AIML-101',
      designation: 'Assistant Professor',
      specialization: 'Deep Learning & Artificial Intelligence',
      qualification: 'M.Tech, Ph.D.',
      status: 'APPROVED',
      approvedBy: aimlHod._id,
      approvedAt: new Date()
    });

    const faculty2 = await User.create({
      name: 'Prof. Priya Sharma',
      email: 'priya.sharma@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'FACULTY',
      departmentId: createdDepts['CE']._id,
      employeeId: 'FAC-CE-102',
      designation: 'Associate Professor',
      specialization: 'Cloud Computing & Cyber Security',
      qualification: 'Ph.D. Computer Science',
      status: 'APPROVED',
      approvedBy: ceHod._id,
      approvedAt: new Date()
    });

    // 7. Create Pending Faculty Registration
    const pendingFaculty = await User.create({
      name: 'Prof. Amit Chaudhari',
      email: 'amit.pending@rcpit.ac.in',
      passwordHash: defaultPasswordHash,
      role: 'FACULTY',
      departmentId: createdDepts['AIML']._id,
      employeeId: 'FAC-AIML-999',
      designation: 'Assistant Professor',
      specialization: 'Computer Vision',
      qualification: 'M.Tech',
      status: 'PENDING'
    });

    console.log('[Seed] Created Roles (Admin, Director, TP, HODs, Approved & Pending Faculty)');

    // 8. Create Venues
    const venueAuditorium = await Venue.create({
      name: 'Main Institutional Auditorium',
      code: 'AUD-01',
      capacity: 600,
      location: 'Main Building Block A, 1st Floor',
      facilities: ['Projector', 'Sound System', 'AC', 'Stage Lighting', 'Live Stream']
    });

    const venueSeminar1 = await Venue.create({
      name: 'Central Seminar Hall 1',
      code: 'SEM-01',
      capacity: 180,
      location: 'Science & Humanities Wing, Ground Floor',
      facilities: ['Projector', 'Podium Mic', 'AC']
    });

    const venueLab5 = await Venue.create({
      name: 'AIML Advanced AI Research Lab',
      code: 'LAB-AIML-05',
      capacity: 60,
      location: 'IT Building 2nd Floor',
      facilities: ['GPU Workstations', 'Smart Board', 'AC']
    });

    console.log('[Seed] Created Institutional Venues');

    // 9. Create Authentic Institutional Activities
    const act1 = await Activity.create({
      title: 'National Conference on Artificial Intelligence & Smart Systems (NCAISS 2026)',
      category: 'Conference',
      departmentId: createdDepts['AIML']._id,
      description: 'Institutional conference bringing together researchers, faculty, and industry practitioners to discuss advancements in AI models, machine learning algorithms, and intelligent automation systems.',
      objectives: 'To publish research papers and showcase project prototypes developed by engineering scholars.',
      coordinatorId: faculty1._id,
      hodId: aimlHod._id,
      targetAudience: 'Engineering Scholars, Faculty & Researchers',
      guestSpeaker: { name: 'Dr. Rajesh K. Vatsa', designation: 'Principal AI Scientist', organization: 'Google Research' },
      date: new Date('2026-07-15'),
      startTime: '09:00',
      endTime: '18:00',
      durationHours: 24,
      venueId: venueAuditorium._id,
      venueName: venueAuditorium.name,
      expectedParticipants: 200,
      studentParticipantsCount: 180,
      facultyParticipantsCount: 20,
      estimatedBudget: 45000,
      fundingSource: 'Institutional Research Fund',
      status: 'COMPLETED',
      documentationScore: 100,
      isLocked: true,
      qrCodeUrl: '/public/activity/act1_sample'
    });

    await ActivityReport.create({
      activityId: act1._id,
      submittedBy: faculty1._id,
      actualParticipantsCount: 215,
      studentParticipantsCount: 195,
      facultyParticipantsCount: 20,
      outcome: '30 research paper presentations were successfully delivered. Proceedings published with ISBN.',
      keyHighlights: 'Keynote address by Google Research Scientist. Live interactive Q&A session.',
      feedbackSummary: '98% participants rated technical content as Outstanding.',
      achievements: 'Selected papers submitted for IEEE publication.',
      status: 'VERIFIED',
      verifiedBy: aimlHod._id,
      verifiedAt: new Date('2026-07-17')
    });

    // Activity 2: Scheduled Event
    const act2 = await Activity.create({
      title: 'State-Level Workshop on Cloud Native Microservices & DevOps Architectures',
      category: 'Workshop',
      departmentId: createdDepts['CE']._id,
      description: 'Hands-on practical workshop covering Docker containerization, Helm deployment, and Kubernetes cluster orchestration.',
      objectives: 'Provide engineering students with practical cloud deployment experience.',
      coordinatorId: faculty2._id,
      hodId: ceHod._id,
      targetAudience: 'Third & Final Year Computer Science & IT Students',
      guestSpeaker: { name: 'Er. Sandeep Patil', designation: 'Senior Cloud DevOps Engineer', organization: 'Red Hat India' },
      date: new Date('2026-08-25'),
      startTime: '10:00',
      endTime: '16:00',
      venueId: venueSeminar1._id,
      venueName: venueSeminar1.name,
      expectedParticipants: 120,
      status: 'SCHEDULED',
      documentationScore: 50
    });

    await SlotRequest.create({
      activityId: act2._id,
      requestedBy: faculty2._id,
      venueId: venueSeminar1._id,
      requestedDate: new Date('2026-08-25'),
      startTime: '10:00',
      endTime: '16:00',
      status: 'APPROVED',
      reviewedBy: adminUser._id,
      adminNotes: 'Venue confirmed by Admin'
    });

    // Activity 3: Submitted (Pending HOD Review)
    const act3 = await Activity.create({
      title: 'Faculty Development Program on Advanced Data Analytics & AI Applications',
      category: 'FDP',
      departmentId: createdDepts['AIML']._id,
      description: 'One-week FDP focusing on Transformers, Diffusion models, and PyTorch deep learning frameworks.',
      coordinatorId: faculty1._id,
      hodId: aimlHod._id,
      date: new Date('2026-09-10'),
      startTime: '10:00',
      endTime: '16:00',
      status: 'SUBMITTED',
      documentationScore: 30
    });

    // Activity 4: Conducted (Pending Report)
    const act4 = await Activity.create({
      title: 'T&P Campus Recruitment Training & Technical Placement Drive',
      category: 'Placement Drive',
      departmentId: createdDepts['TP']._id,
      description: 'Comprehensive training session for final year engineering students on coding assessment rounds and technical interviews.',
      coordinatorId: tpUser._id,
      date: new Date('2026-08-05'),
      startTime: '11:00',
      endTime: '14:00',
      venueId: venueAuditorium._id,
      venueName: venueAuditorium.name,
      expectedParticipants: 450,
      status: 'REPORT_PENDING',
      documentationScore: 65
    });

    console.log('[Seed] Created Activities across all lifecycle stages');

    // 9.5 Seed Authentic Event Media Photographs & Video Assets
    await Media.create([
      {
        activityId: act1._id,
        uploadedBy: faculty1._id,
        mediaType: 'image',
        fileName: 'ncaiss_keynote.jpg',
        fileUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop',
        caption: 'Keynote Session & Paper Presentations',
        description: 'Google Research Keynote Presentation at NCAISS 2026',
        geotagLocation: 'Main Auditorium Block A, RCPIT Shirpur'
      },
      {
        activityId: act1._id,
        uploadedBy: faculty1._id,
        mediaType: 'image',
        fileName: 'dignitaries_group.jpg',
        fileUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1200&auto=format&fit=crop',
        caption: 'Faculty & Guest Speakers Group Photo',
        description: 'Dignitaries, Director & HOD AIML presenting mementos',
        geotagLocation: 'Auditorium Stage, RCPIT Shirpur'
      },
      {
        activityId: act2._id,
        uploadedBy: faculty2._id,
        mediaType: 'image',
        fileName: 'devops_lab.jpg',
        fileUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop',
        caption: 'DevOps & Docker Kubernetes Lab Session',
        description: 'Hands-on containerization and cluster management training',
        geotagLocation: 'Central Seminar Hall 1, RCPIT Shirpur'
      },
      {
        activityId: act2._id,
        uploadedBy: faculty2._id,
        mediaType: 'image',
        fileName: 'student_debugging.jpg',
        fileUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
        caption: 'Student Collaboration & Code Debugging',
        description: 'Third and Final Year Computer Engineering participants',
        geotagLocation: 'Science Wing Lab 2, RCPIT Shirpur'
      },
      {
        activityId: act4._id,
        uploadedBy: tpUser._id,
        mediaType: 'image',
        fileName: 'tp_orientation.jpg',
        fileUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1200&auto=format&fit=crop',
        caption: 'T&P Technical Mock Interview & Orientation Drive',
        description: 'Campus Placement Officer addressing 450+ engineering candidates',
        geotagLocation: 'Main Institutional Auditorium, RCPIT Shirpur'
      }
    ]);

    console.log('[Seed] Created Event Media Assets');

    // 10. Create Initial System Notifications
    await Notification.create({
      recipientId: aimlHod._id,
      senderId: pendingFaculty._id,
      title: 'New Faculty Registration Pending',
      message: 'Prof. Amit Chaudhari has registered for AIML department and requires your HOD verification.',
      category: 'Approval',
      priority: 'HIGH',
      link: '/admin/users'
    });

    // 11. Initial Audit Log
    await AuditLog.create({
      userName: adminUser.name,
      userRole: 'ADMIN',
      action: 'SYSTEM_INITIALIZATION',
      entity: 'System',
      details: 'ActivityTracker RCPIT production database initialized with institutional departments, real HOD profiles, and verified venue master entries.',
      result: 'SUCCESS'
    });

    console.log('=======================================================');
    console.log('✅ PRODUCTION DATABASE INITIALIZED SUCCESSFULLY!');
    console.log('=======================================================');
  } catch (err) {
    console.error('[Seed Error]', err);
  } finally {
    if (!auto) {
      mongoose.disconnect();
    }
  }
};

// Check if run directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase(false);
}

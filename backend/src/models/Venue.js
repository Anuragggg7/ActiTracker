import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    building: { type: String, default: 'Main Building' },
    floor: { type: String, default: 'Ground Floor' },
    capacity: { type: Number, required: true },
    location: { type: String, default: 'Main Campus' },
    facilities: [{ type: String }],
    active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

venueSchema.pre('save', function (next) {
  if (this.active !== undefined) this.isActive = this.active;
  if (this.isActive !== undefined) this.active = this.isActive;
  next();
});

export default mongoose.model('Venue', venueSchema);

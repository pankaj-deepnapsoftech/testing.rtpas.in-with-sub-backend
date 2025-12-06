const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionOrderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  plan: { type: String, enum: ['Free Trial', 'KONTRONIX', 'SOPAS', 'RTPAS'], required: true,default:"Free Trial" },
  amount: { type: Number, required: true,default:0 }, // in paise
  currency: { type: String, default: 'INR' },
  razorpayOrderId: { type: String, unique: true },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  period: { type: String, enum: ['month', 'year',"week"], default: 'week' },
  allowedUsers: { type: Number, default: 0 },
}, { timestamps: true });

const SubscriptionOrder = mongoose.model('SubscriptionOrder', SubscriptionOrderSchema);

module.exports = { SubscriptionOrder };

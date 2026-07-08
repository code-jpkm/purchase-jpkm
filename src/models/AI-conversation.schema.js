const mongoose = require('mongoose');
const { Schema } = mongoose;

const AIConversationSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, default: 'New Gemini conversation' },
  messages: [{ role: { type: String, enum: ['user', 'assistant', 'system'], required: true }, content: String, createdAt: { type: Date, default: Date.now } }],
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: 'ai_conversations' });

AIConversationSchema.index({ tenantId: 1, userId: 1, updatedAt: -1 });
module.exports = mongoose.model('AIConversation', AIConversationSchema);

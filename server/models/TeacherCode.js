const mongoose = require('mongoose');

const teacherCodeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // код живёт 10 минут
});

module.exports = mongoose.model('TeacherCode', teacherCodeSchema);

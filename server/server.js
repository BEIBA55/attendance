const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config(); // Загружаем переменные окружения

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

// Модели
const Student = require('./models/Student');
const Attendance = require('./models/Attendance');
const Subject = require('./models/Subject');
const User = require('./models/User');

// Middleware авторизации
const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Нет токена' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Неверный токен' });

      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }

      req.user = user;
      next();
    });
  };
};

// Тестовый маршрут
app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: 'Пользователь создан' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Логин пользователя
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Пользователь не найден' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Неверный пароль' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Возвращаем токен И роль
    res.json({ 
      token,
      role: user.role  // Добавляем роль в ответ
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CRUD для студентов
app.post('/students', authMiddleware(['admin']), async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Create User record for authentication
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword, // Store hashed password
      role: 'student'
    });
    await newUser.save();

    // Create Student record with the same _id as the User record
    const newStudent = new Student({
      _id: newUser._id, // Use the same _id as the created user
      name,
      email
    });
    await newStudent.save();

    res.status(201).json({ student: newStudent, user: { email, role: 'student' } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/students', authMiddleware(['admin', 'teacher']), async (req, res) => {
  try {
    const students = await Student.find();
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/students/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const deletedStudent = await Student.findByIdAndDelete(req.params.id);
    if (!deletedStudent) {
      return res.status(404).json({ message: 'Студент не найден' });
    }
    res.json({ message: 'Студент успешно удален' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CRUD для предметов
app.post('/subjects', authMiddleware(['admin']), async (req, res) => {
  const { name, code, teacherId } = req.body;
  try {
    const newSubject = new Subject({ name, code, teacher: teacherId });
    await newSubject.save();
    res.status(201).json(newSubject);
  } catch (err) {
    console.error('Error adding subject:', err);
    res.status(400).json({ message: err.message });
  }
});

app.get('/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to get a single subject by ID
app.get('/subjects/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('teacher');
    if (!subject) {
      return res.status(404).json({ message: 'Предмет не найден' });
    }
    res.json(subject);
  } catch (error) {
    console.error('Error fetching subject by ID:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to update a subject
app.put('/subjects/:id', authMiddleware(['admin']), async (req, res) => {
  const { name, code, teacherId } = req.body;
  try {
    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, code, teacher: teacherId },
      { new: true } // Return the updated document
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: 'Предмет не найден' });
    }

    res.json(updatedSubject);
  } catch (err) {
    console.error('Error updating subject:', err);
    res.status(400).json({ message: err.message });
  }
});

// Endpoint to delete a subject
app.delete('/subjects/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const deletedSubject = await Subject.findByIdAndDelete(req.params.id);
    if (!deletedSubject) {
      return res.status(404).json({ message: 'Предмет не найден' });
    }
    res.json({ message: 'Предмет успешно удален' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ message: error.message });
  }
});

// CRUD для учителей
app.post('/teachers', authMiddleware(['admin']), async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'teacher'
    });
    await newUser.save();

    // Note: We don't have a separate Teacher model, User model is sufficient for authentication and role.
    // If you needed teacher-specific data beyond name/email, you would create a Teacher model here
    // similar to how we handle students.

    res.status(201).json({ message: 'Учитель успешно добавлен', user: { _id: newUser._id, email: newUser.email, role: newUser.role } });
  } catch (error) {
    console.error('Error adding teacher:', error);
    res.status(400).json({ message: error.message });
  }
});

app.get('/teachers', authMiddleware(['admin']), async (req, res) => {
  try {
    // Find all users with the role 'teacher'
    const teachers = await User.find({ role: 'teacher' }).select('-password'); // Exclude password
    res.status(200).json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/teachers/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    // Find and delete the user with the specified ID and 'teacher' role
    const deletedUser = await User.findOneAndDelete({ _id: req.params.id, role: 'teacher' });

    if (!deletedUser) {
      return res.status(404).json({ message: 'Учитель не найден или не имеет роли учителя' });
    }

    res.json({ message: 'Учитель успешно удален' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ message: error.message });
  }
});

// Посещаемость
app.post('/attendance', authMiddleware(['teacher', 'admin']), async (req, res) => {
  const { subjectId, date, attendance } = req.body;
  try {
    // Find existing attendance record for the subject and date
    let existingAttendance = await Attendance.findOne({ subjectId, date });

    if (existingAttendance) {
      // If record exists, update student attendance statuses
      console.log('Existing attendance record found:', existingAttendance);
      attendance.forEach(studentStatus => {
        console.log('Processing student status update for student ID:', studentStatus.studentId, 'with status:', studentStatus.isPresent);
        const studentIndex = existingAttendance.attendance.findIndex(
          (att) => att.studentId.toString() === studentStatus.studentId
        );

        if (studentIndex > -1) {
          // Update existing student entry
          console.log('Student found in existing record, updating status.');
          existingAttendance.attendance[studentIndex].isPresent = studentStatus.isPresent;
        } else {
          // Add new student entry if not found
          console.log('Student not found in existing record, adding new entry.');
          existingAttendance.attendance.push(studentStatus);
        }
      });

      await existingAttendance.save();
      console.log('Attendance record after update:', existingAttendance);
      res.status(200).json(existingAttendance); // Return 200 for update

    } else {
      // If no record exists, create a new one
      const newAttendance = new Attendance({ subjectId, date, attendance });
      await newAttendance.save();
      res.status(201).json(newAttendance); // Return 201 for creation
    }

  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(400).json({ message: error.message });
  }
});

app.get('/attendance', authMiddleware(['admin', 'teacher']), async (req, res) => {
  try {
    let records;
    
    // Get date range from query parameters
    const { startDate, endDate } = req.query;

    const filter = {};

    // If the user is a teacher, filter by their subjects
    if (req.user.role === 'teacher') {
      const teacherSubjects = await Subject.find({ teacher: req.user.id });
      const subjectIds = teacherSubjects.map(subject => subject._id);
      filter.subjectId = { $in: subjectIds };
    }

    // If date range is provided, add it to the filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        // To include the end date, set the upper bound to the beginning of the next day
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        filter.date.$lt = end;
      }
    }

    records = await Attendance.find(filter)
      .populate('subjectId')
      .populate('attendance.studentId');

    
  const formatted = records.map((r) => ({
    _id: r._id,
    date: r.date,
    subject: r.subjectId,
    attendance: r.attendance.map((a) => ({
      student: a.studentId,
      isPresent: a.isPresent
    }))
  }));

  res.json(formatted);
} catch (error) {
  console.error('Error fetching attendance report:', error);
  res.status(500).json({ message: error.message });
}
});

// Маршрут для студента: посмотреть своё посещение
app.get('/my-attendance', authMiddleware(['student']), async (req, res) => {
  const studentId = req.user.id;
  console.log(`Fetching attendance for student ID: ${studentId}`);
  try {
    // Filter attendance records in the database query to only include those with the student's attendance
    const records = await Attendance.find({
      'attendance.studentId': studentId
    })
      .populate('subjectId')
      .populate('attendance.studentId');

    console.log('Fetched attendance records (filtered):', records);

    const myAttendance = records.map((r) => {
      console.log('Checking attendance entries for record:', r.attendance);
      const studentAttendanceEntry = r.attendance.find(
        (a) => a.studentId && a.studentId._id.toString() === studentId
      );

      console.log('Result of find for student', studentId, ':', studentAttendanceEntry);

      // Only include records where the student was either marked present or absent,
      // or where the attendance record itself exists (indicating they could have attended).
      // We will let the client handle displaying 'Not Marked' if studentAttendanceEntry is null.
      return {
        _id: r._id,
        date: r.date,
        subject: r.subjectId ? r.subjectId.name : 'Unknown Subject',
        isPresent: studentAttendanceEntry ? studentAttendanceEntry.isPresent : null, // Use null to indicate not marked
        isMarked: !!studentAttendanceEntry // Add a flag to indicate if the student was marked in this record
      };
    });

    console.log('Processed attendance for student:', myAttendance);

    res.json(myAttendance);
  } catch (error) {
    console.error('Error in /my-attendance:', error);
    res.status(500).json({ message: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

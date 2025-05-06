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
  const { name, email } = req.body;
  try {
    const newStudent = new Student({ name, email });
    await newStudent.save();
    res.status(201).json(newStudent);
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
  const { name, code } = req.body;
  try {
    const newSubject = new Subject({ name, code });
    await newSubject.save();
    res.status(201).json(newSubject);
  } catch (err) {
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

// Посещаемость
app.post('/attendance', authMiddleware(['teacher', 'admin']), async (req, res) => {
  const { subjectId, date, attendance } = req.body;
  try {
    const newAttendance = new Attendance({ subjectId, date, attendance });
    await newAttendance.save();
    res.status(201).json(newAttendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/attendance', authMiddleware(['admin', 'teacher']), async (req, res) => {
  const records = await Attendance.find()
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
});

// Маршрут для студента: посмотреть своё посещение
app.get('/my-attendance', authMiddleware(['student']), async (req, res) => {
  const studentId = req.user.id;
  try {
    const records = await Attendance.find()
      .populate('subjectId')
      .populate('attendance.studentId');

    const myAttendance = records.map((r) => ({
      _id: r._id,
      date: r.date,
      subject: r.subjectId.name,
      isPresent: r.attendance.find((a) => a.studentId._id.toString() === studentId)?.isPresent
    })).filter(r => r.isPresent !== undefined);

    res.json(myAttendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

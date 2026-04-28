import express from 'express';
import { getProfessors, getProfessorById } from '../controllers/publicController.js';

const router = express.Router();

// list professors
router.get('/professors', getProfessors);

// get single professor by id
router.get('/professors/:id', getProfessorById);

export default router;
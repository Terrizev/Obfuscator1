import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import sanitizeFilename from 'sanitize-filename';
import JsConfuser from 'js-confuser';
import fs from 'fs/promises';
import csrf from 'csurf';
import dotenv from 'dotenv';

// Config
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(csrf({ cookie: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// File Upload Config
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const validTypes = ['application/javascript', 'text/javascript'];
    if (validTypes.includes(file.mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JavaScript files (.js) are allowed!'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Code Obfuscator Pro',
    csrfToken: req.csrfToken(),
    message: null
  });
});

app.post('/upload', 
  upload.single('jsfile'),
  [
    body('obfuscationLevel').isIn(['low', 'medium', 'high']),
    body('csrfToken').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('index', { 
        title: 'Error',
        csrfToken: req.csrfToken(),
        message: errors.array()[0].msg 
      });
    }

    try {
      const fileContent = await fs.readFile(req.file.path, 'utf8');
      const obfuscatedCode = await JsConfuser.obfuscate(
        fileContent, 
        getObfuscationConfig(req.body.obfuscationLevel)
      );

      const outputFilename = `obfuscated-${req.file.filename}`;
      const outputPath = path.join(__dirname, 'public', 'downloads', outputFilename);
      
      await fs.writeFile(outputPath, obfuscatedCode);
      await fs.unlink(req.file.path); // Cleanup

      res.render('result', {
        title: 'Obfuscation Complete',
        downloadLink: `/downloads/${outputFilename}`,
        originalFilename: req.file.originalname,
        csrfToken: req.csrfToken()
      });

    } catch (error) {
      console.error('Error:', error);
      res.status(500).render('index', {
        title: 'Error',
        csrfToken: req.csrfToken(),
        message: 'Obfuscation failed. Please try again.'
      });
    }
  }
);

// Obfuscation Config (Your Custom Settings)
function getObfuscationConfig(level) {
  const baseConfig = {
    target: "node",
    compact: true,
    minify: true,
    renameVariables: true,
    renameGlobals: true,
    stringEncoding: true,
    stringConcealing: true,
    stringCompression: true,
    duplicateLiteralsRemoval: 1.0,
    hexadecimalNumbers: true,
    identifierGenerator: () => {
      const originalString = "素TERRI晴DEV晴" + "素TERRI晴DEV晴";
      const cleanString = originalString.replace(/[^a-zA-Z素TERRI晴DEV晴]/g, "");
      const randomChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      const randomSuffix = Array.from({length: 2}, () => 
        randomChars.charAt(Math.floor(Math.random() * randomChars.length))).join('');
      return cleanString + randomSuffix;
    }
  };

  const levelConfigs = {
    low: { controlFlowFlattening: 0.3, opaquePredicates: 0.2 },
    medium: { controlFlowFlattening: 0.7, opaquePredicates: 0.5, flatten: true },
    high: { 
      controlFlowFlattening: 1.0,
      opaquePredicates: 0.9,
      flatten: true,
      stack: true,
      dispatcher: true,
      calculator: true,
      movedDeclarations: true,
      objectExtraction: true,
      globalConcealing: true
    }
  };

  return { ...baseConfig, ...levelConfigs[level] };
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
});

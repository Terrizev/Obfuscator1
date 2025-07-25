import express from 'express';
import pkg from 'js-confuser';
const { JsConfuser } = pkg;
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import csrf from 'csurf';

dotenv.config();
const app = express();
const csrfProtection = csrf({ cookie: true });

// S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  }
});

// File Upload Setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/javascript') {
      cb(null, true);
    } else {
      cb(new Error('Only JavaScript files allowed'), false);
    }
  }
});

// Obfuscation Config (v2 Compatible)
const getObfuscationConfig = (level) => ({
  target: 'browser',
  preset: level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low',
  identifierGenerator: () => {
    const base = "素TERRI晴DEV晴".replace(/[^a-zA-Z素TERRI晴DEV晴]/g, "");
    return base + Math.random().toString(36).slice(2, 4);
  },
  // Additional v2-specific options
  deadCode: level === 'high' ? 0.3 : 0,
  stringSplitting: level !== 'low',
  shuffle: level === 'high'
});

// Routes
app.post('/upload', upload.single('jsfile'), csrfProtection, async (req, res) => {
  try {
    const obfuscated = await JsConfuser.obfuscate(
      req.file.buffer.toString('utf8'),
      getObfuscationConfig(req.body.level)
    );

    // Upload to S3
    const s3Key = `obfuscated-${Date.now()}.js`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: s3Key,
      Body: obfuscated,
      ContentType: 'application/javascript'
    }));

    res.json({
      downloadUrl: `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${s3Key}`
    });
  } catch (error) {
    console.error('Obfuscation error:', error);
    res.status(500).send('Obfuscation failed');
  }
});

app.listen(process.env.PORT || 3000);

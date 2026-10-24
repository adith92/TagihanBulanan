import { isConfigured } from '../lib/auth.js';
export default function handler(req,res){res.setHeader('Cache-Control','no-store');res.status(200).json({service:'Tagihan Bulanan',authReady:isConfigured(),storageReady:!!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID),timestamp:new Date().toISOString()});}

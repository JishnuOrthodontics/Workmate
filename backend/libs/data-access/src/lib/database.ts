import { Schema, Types } from 'mongoose';

export { Schema, Types };

export const connectDB = async () => {
  // Connection handled by main application bootstrap
  console.log('MongoDB connection setup - will connect via main server');
};

export const getModel = (modelName: string) => {
  // Model retrieval helper
  return (require(`mongoose`).models as any)[modelName];
};

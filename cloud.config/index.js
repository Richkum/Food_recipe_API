import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
  process.env;

if (!CLOUDINARY_CLOUD_NAME) {
  throw new Error("CLOUDINARY_CLOUD_NAME is not defined");
}
if (!CLOUDINARY_API_KEY) {
  throw new Error("CLOUDINARY_API_KEY is not defined");
}
if (!CLOUDINARY_API_SECRET) {
  throw new Error("CLOUDINARY_API_SECRET is not defined");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

// Function to upload image to Cloudinary

const uploadImage = async (file) => {
  if (!file || !file.path) {
    throw new Error("Invalid file parameter");
  }

  try {
    const result = await cloudinary.uploader.upload(file.path);
    if (!result || !result.secure_url) {
      throw new Error("Error uploading image to Cloudinary");
    }

    return result.secure_url;
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    throw new Error("Error uploading image to Cloudinary");
  }
};

export { uploadImage };

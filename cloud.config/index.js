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

// Function to upload image to Cloudinary
const uploadImage = async (file) => {
  // Check if the 'file' parameter is valid. It must have a 'path' property.
  if (!file || !file.path) {
    throw new Error(
      "Invalid file parameter. File must have a 'path' property."
    );
  }

  try {
    // Upload the file to Cloudinary using the cloudinary.uploader.upload() method.
    const result = await cloudinary.uploader.upload(file.path);

    // Check if the upload was successful. The result should have a 'secure_url' property.
    if (!result || !result.secure_url) {
      throw new Error("Error uploading image to Cloudinary");
    }

    // Return the secure URL of the uploaded image.
    return result.secure_url;
  } catch (error) {
    // Log the error and re-throw it.
    console.error("Error uploading image to Cloudinary:", error);
    throw new Error("Error uploading image to Cloudinary");
  }
};

export { uploadImage };

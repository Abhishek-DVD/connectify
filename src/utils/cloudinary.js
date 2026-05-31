const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadProfilePhoto = (fileBuffer, userId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "connectify/profile-photos",
                public_id: userId.toString(),
                overwrite: true,
                resource_type: "image",
                transformation: [
                    {width: 800, height: 800, crop: "fill", gravity: "face"},
                    {quality: "auto", fetch_format: "auto"},
                ],
            },
            (error, result) => {
                if(error){
                    return reject(error);
                }
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });
}

module.exports = {
    uploadProfilePhoto,
}

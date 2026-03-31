export type GenerateMetadataOptions = {
    uploadBlob?: (blob: Blob) => Promise<{ src: string }>;
};

export function generateMetadata(
    blob: Blob | File,
    { uploadBlob }: GenerateMetadataOptions = {}
) {
    return new Promise<Record<string, unknown>>((resolve) => {
        if (blob.type.startsWith("image/")) {
            const img = new Image();

            img.src = URL.createObjectURL(blob);

            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                });
            };

            img.onerror = () => resolve({});

            return;
        }

        if (blob.type.startsWith("video/")) {
            const video = document.createElement("video");

            video.onloadeddata = () => {
                const canvas = document.createElement("canvas");

                canvas.width = video.videoWidth;

                canvas.height = video.videoHeight;

                const context = canvas.getContext("2d");

                if (!context) {
                    return resolve({
                        width: video.videoWidth,
                        height: video.videoHeight,
                    });
                }

                video.addEventListener("seeked", () => {
                    context.drawImage(
                        video,
                        0,
                        0,
                        video.videoWidth,
                        video.videoHeight
                    );

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            return resolve({
                                width: video.videoWidth,
                                height: video.videoHeight,
                            });
                        }

                        if (uploadBlob) {
                            uploadBlob(blob).then(({ src }) => {
                                resolve({
                                    width: video.videoWidth,
                                    height: video.videoHeight,
                                    poster: src,
                                });
                            });
                        } else {
                            resolve({
                                width: video.videoWidth,
                                height: video.videoHeight,
                                poster: canvas.toDataURL("image/webp"),
                            });
                        }
                    }, "image/jpeg");
                });

                video.currentTime = 0;
            };

            video.onerror = () => resolve({});

            video.src = URL.createObjectURL(blob);

            return;
        }

        resolve({});
    });
}

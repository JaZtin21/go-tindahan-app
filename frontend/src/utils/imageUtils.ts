// tinybase/imageUtils.ts
//
// TinyBase cells only hold string/number/boolean -- a File object can't go
// in directly. This converts a File to a base64 data URL (which any img
// src can render as-is) and resizes it down first, since raw phone
// camera photos can be several MB each and would otherwise bloat every
// IndexedDB write.

export async function fileToStorableBase64(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    if (!file.type.startsWith('image/')) return dataUrl; // non-image files: skip resizing

    return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(dataUrl); // fallback to unresized original
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Reverse of fileToStorableBase64 — turns a stored base64 data URL back into
// a real File, so it can be sent through your normal upload mechanism during
// sync. Only called on rows whose `photo` is still a data: URL (meaning it
// was taken/added while offline and never actually uploaded anywhere).
export function base64ToFile(dataUrl: string, filename: string): File {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
}



/**
 * Validates, resizes, and converts any input file strictly into a WebP File object.
 * @param file The original native File object from the input element
 * @param maxDimension The strict maximum width or height (default 400px)
 * @param quality The compression factor from 0.0 to 1.0 (default 0.7)
 */
export const resizeAndConvertToWebPFile = (
    file: File,
    maxDimension = 400,
    quality = 0.7
): Promise<File> => {
    return new Promise((resolve, reject) => {

        // 🚀 1. FILE TYPE VALIDATION CHECK
        // Ensure the file's mime type starts with 'image/' (e.g., image/jpeg, image/png, image/webp)
        if (!file.type.startsWith('image/')) {
            reject(new Error("Invalid file type. Please upload a valid image file (PNG, JPG, WebP)."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Force strict maximum dimension constraints while keeping the aspect ratio
                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Forces the canvas to output an image/webp binary blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to WebP Blob conversion failed"));
                            return;
                        }

                        // Swap the original extension in the filename to .webp
                        const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        const webpFilename = `${originalNameWithoutExt}.webp`;

                        // Build the new clean WebP File object to pass back
                        const webpFile = new File([blob], webpFilename, {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        });

                        resolve(webpFile);
                    },
                    'image/webp',
                    quality
                );
            };
            img.onerror = () => reject(new Error("The selected file is corrupted or cannot be read as an image."));
        };
        reader.onerror = () => reject(new Error("Failed to read binary file data."));
    });
};


import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

export const ScanPage = () => {
    const [model, setModel] = useState<any>(null);
    const [labelsMap, setLabelsMap] = useState<any>(null);
    const [loadingStatus, setLoadingStatus] = useState('Loading...');
    const [predictionResult, setPredictionResult] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function loadAssets() {
            try {
                const loadedModel = await tf.loadGraphModel('/web_model/model.json');
                setModel(loadedModel);

                const response = await fetch('/labels_mapping.json');
                const mappingData = await response.json();
                const lookup: any = {};
                Object.entries(mappingData).forEach(([folderName, data]: [string, any]) => {
                    lookup[data.class_index] = { visualLabel: data.visual_label, rawFolder: folderName };
                });
                setLabelsMap(lookup);
                setLoadingStatus('Ready!');
            } catch (error) {
                console.error("Load failed:", error);
                setLoadingStatus('Error loading assets.');
            }
        }
        loadAssets();
    }, []);

    const processAndAnalyzeImage = async (imgElement: HTMLImageElement) => {
        if (!model || !labelsMap) return;
        setLoadingStatus('Analyzing...');

        // 📊 LOG 1: Log original HTML Image Element dimensions
        console.log(`[RAW IMAGE] Uploaded Dimensions -> Width: ${imgElement.width}px, Height: ${imgElement.height}px`);

        const result = tf.tidy(() => {
            const rawTensor = tf.browser.fromPixels(imgElement, 3);

            // 📊 LOG 2: Log initial raw Tensor dimensions before conversion math
            console.log(`[RAW TENSOR] Initial shape before processing -> [${rawTensor.shape.join(', ')}] (Height, Width, Channels)`);

            // Check if it's already exactly what MobileNet expects
            const isCorrectSize = rawTensor.shape[0] === 224 && rawTensor.shape[1] === 224;
            console.log(`[SIZE CHECK] Is original image already exactly 224x224? -> ${isCorrectSize}`);

            // Force the 224x224 shape constraint
            const resizedTensor = tf.image.resizeBilinear(rawTensor, [224, 224]);

            // 📊 LOG 3: Confirm final target dimensions are set
            console.log(`[PROCESSED TENSOR] Resized shape to feed model -> [${resizedTensor.shape.join(', ')}]`);

            // Match your exact Python training scaling math (0.0 to 1.0)
            const normalizedTensor = resizedTensor.toFloat().div(255.0);
            const batchTensor = normalizedTensor.expandDims(0);

            // Execute prediction and clean up logits
            const rawOutput = model.execute(batchTensor) as tf.Tensor;
            const softmaxOutput = tf.softmax(rawOutput);

            const probabilities = softmaxOutput.dataSync();
            const predictedClassId = softmaxOutput.argMax(-1).dataSync()[0];
            const confidenceScore = probabilities[predictedClassId];

            console.log(`[MODEL CONFIRMATION] Is model fully loaded? -> ${!!model}`);
            console.log(`[PREDICTED INDEX] Max probability hit index -> ${predictedClassId}`);
            console.log(`[RAW SCORE] Model confidence value decimal -> ${confidenceScore}`);

            return { predictedClassId, confidenceScore };
        });

        const productInfo = labelsMap[result.predictedClassId];
        if (productInfo) {
            setPredictionResult({
                label: productInfo.visualLabel,
                folder: productInfo.rawFolder,
                confidence: (result.confidenceScore * 100).toFixed(2),
                classId: result.predictedClassId
            });
        } else {
            setPredictionResult({
                label: "Unknown Product",
                folder: "unknown",
                confidence: (result.confidenceScore * 100).toFixed(2),
                classId: result.predictedClassId
            });
        }
        setLoadingStatus('Done.');
    };

    const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPredictionResult(null);
        const img = new Image();
        img.onload = () => {
            processAndAnalyzeImage(img);
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    };

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
            <h3>Status: {loadingStatus}</h3>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Upload Image to Test
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageFileUpload} accept="image/*" style={{ display: 'none' }} />

            {predictionResult && (
                <div style={{ marginTop: '20px', padding: '15px', background: '#e2f0d9', border: '1px solid #385723', textAlign: 'left' }}>
                    <p><strong>Product:</strong> {predictionResult.label}</p>
                    <p><strong>Confidence:</strong> {predictionResult.confidence}%</p>
                    <p><strong>Index:</strong> {predictionResult.classId}</p>
                </div>
            )}
        </div>
    );
};

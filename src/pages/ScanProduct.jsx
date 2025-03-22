import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebcamCapture from '../components/WebcamCapture';
import '../styles/ScanProduct.css';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const genAI = new GoogleGenerativeAI('AIzaSyB25o3qeXESYDlOVMBKdM-xFEbZaUZjwGc');

const OCRPROMPT = "return the ingredients displayed in the image as a list in this exact format: [item1name, item2name, item3name]";

const ANALYSISPROMPT = `Analyze these skincare/medication ingredients and return JSON with:
{
  "ingredients": [
    {
      "ingredient_name": "example",
      "background": "[origin/history from PubChem/NIH]",
      "usage": "[function]",
      "other_names": "synonyms",
      "side_effects": ["list"],
      "concerns": ["bans/warnings"],
      "safe": "safe/caution"
    }
  ],
  "overallSafety": "Safe/Low Risk/Moderate/High Risk",
  "recommendations": "Tailored advice based on risks"
}

**Rules for overallSafety**:
1. **High Risk** if:
   - Any ingredient is banned in EU/US/Japan
   - Contains carcinogens, endocrine disruptors, or severe allergens (e.g., formaldehyde)
2. **Moderate Risk** if:
   - Contains regionally restricted ingredients (e.g., phenoxyethanol limited to 1% in EU)
   - 1+ severe allergen (e.g., methylisothiazolinone)
3. **Low Risk** if:
   - 2+ minor cautions (e.g., drying alcohols, fragrance allergens)
4. **Safe** if:
   - No banned/restricted ingredients
   - ≤1 minor caution

**Recommendations must**:
- Mention specific banned/risky ingredients
- Suggest alternatives for High/Moderate risks
- Example: 'Avoid: Contains EU-banned hydroquinone'

**Prioritize data from**:
- Bans: EU CosIng, FDA Prohibited List
- Toxicity: NIH HSDB, IARC
- Allergens: EWG Skin Deep

**Example Output**:
{
  "ingredients": [
    {
      "ingredient_name": "Phenoxyethanol",
      "background": "Synthetic preservative developed in the 1950s...",
      "usage": "Antimicrobial agent",
      "other_names": "EGPE, Rose Ether",
      "side_effects": ["Skin irritation at >1%"],
      "concerns": ["Restricted to 1% in EU"],
      "safe": "caution"
    },
    {
      "ingredient_name": "Retinol",
      "background": "Vitamin A derivative first synthesized in 1947...",
      "usage": "Anti-aging",
      "other_names": "Vitamin A alcohol",
      "side_effects": ["Dryness", "Photosensitivity"],
      "concerns": ["Not recommended during pregnancy"],
      "safe": "caution"
    }
  ],
  "overallSafety": "Moderate",
  "recommendations": "Contains 2 cautionary ingredients. Phenoxyethanol is restricted in the EU; retinol may cause irritation. Consult a dermatologist."
}

Ingredients: `;

const ScanProduct = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleBackClick = () => {
    navigate('/');
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(URL.createObjectURL(file));
      await analyzeImage(file);
    }
  };

  const handleWebcamCapture = async (imageSrc) => {
    setShowWebcam(false);
    setSelectedImage(imageSrc);
    // Convert base64 to blob for analysis
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    await analyzeImage(blob);
  };

  const analyzeImage = async (imageData) => {
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        const imagePart = {
          inlineData: {
            data: base64data,
            mimeType: imageData.type,
          },
        };

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const prompt = OCRPROMPT;

        try {
          const ocr = await model.generateContent([prompt, imagePart]);
          const ingredients = ocr.response.text();
          console.log(ingredients);

          const analyze = await model.generateContent([ANALYSISPROMPT + ingredients]);
          const analyzeResponse = await analyze.response.text();
          console.log(analyzeResponse);

          let parsedResponse;
          try {
            const cleanJson = analyzeResponse
              .replace(/^```json?\n|\n```$/g, '')  // Remove starting/ending backticks and 'json'```
              .trim();

            parsedResponse = JSON.parse(cleanJson.trim());
          } catch (error) {
            console.error("Failed to parse JSON:", error, analyzeResponse);
            return;
          }

          const formattedAnalysis = {
            ingredients: parsedResponse.ingredients.map(ingredient => ({
              name: ingredient.ingredient_name,
              safety: ingredient.safe.charAt(0).toUpperCase() + ingredient.safe.slice(1),
              description: `${ingredient.usage} ${ingredient.background}`,
              otherNames: ingredient.other_names,
              sideEffects: ingredient.side_effects,
              concerns: ingredient.concerns,
            })),
            overallSafety: parsedResponse.overallSafety,
            recommendations: parsedResponse.recommendations,
          };

          setAnalysis(formattedAnalysis);
        } catch (error) {
          console.error("Error during API calls:", error);
        }
      };
      reader.readAsDataURL(imageData);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (analyzing) {
    return (
      <div className="analysis-loading">
        <div className="spinner"></div>
        <h2>Analyzing your product...</h2>
        <p>This may take a few moments</p>
      </div>
    );
  }

  if (analysis) {
    return (
      <div className="analysis-results">
        <button className="back-button" onClick={() => setAnalysis(null)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="results-container">
          <h1>Analysis Results</h1>
          
          <div className="image-preview">
            <img src={selectedImage} alt="Analyzed product" />
          </div>

          <div className="safety-score">
            <h2>Overall Safety: {analysis.overallSafety}</h2>
            <p>{analysis.recommendations}</p>
          </div>

          <div className="ingredients-list">
            <h2>Ingredients Analysis</h2>
            {analysis.ingredients.map((ingredient, index) => (
              <div key={index} className={`ingredient-item ${ingredient.safety.toLowerCase()}`}>
                <h3>{ingredient.name}</h3>
                <span className="safety-badge">{ingredient.safety}</span>
                <p>{ingredient.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-product-page">
      <button className="back-button" onClick={handleBackClick}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Home
      </button>

      {showWebcam ? (
        <WebcamCapture
          onCapture={handleWebcamCapture}
          onClose={() => setShowWebcam(false)}
        />
      ) : (
        <div className="scan-product-container">
          <h1 className="scan-title">Scan Label</h1>
          
          <p className="scan-description">
            Upload a photo or scan your skincare product's ingredient list to analyze what's in it.
          </p>
          
          <div className="upload-container">
            <div className="upload-area">
              <div className="upload-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M12 5L8 9M12 5L16 9" stroke="#0077FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              
              <h2 className="upload-title">Upload a photo of ingredients</h2>
              
              <p className="upload-instruction">
                Take a clear photo of the ingredients list on your skincare product packaging
              </p>
              
              <div className="upload-buttons">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button className="upload-button" onClick={handleUploadClick}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 16.5V18.75C3 19.9926 4.00736 21 5.25 21H18.75C19.9926 21 21 19.9926 21 18.75V16.5M16.5 12L12 7.5M12 7.5L7.5 12M12 7.5V16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Upload Image
                </button>
                
                <button className="photo-button" onClick={() => setShowWebcam(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 9C11.2044 9 10.4413 9.31607 9.87868 9.87868C9.31607 10.4413 9 11.2044 9 12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12C15 11.2044 14.6839 10.4413 14.1213 9.87868C13.5587 9.31607 12.7956 9 12 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 9C3 7.93913 3.42143 6.92172 4.17157 6.17157C4.92172 5.42143 5.93913 5 7 5H8.59C8.97931 5.00004 9.36186 4.89289 9.69 4.69L11.39 3.69C11.7448 3.46527 12.1484 3.34197 12.56 3.33H15C16.0609 3.33 17.0783 3.75143 17.8284 4.50158C18.5786 5.25172 19 6.26913 19 7.33V16.67C19 17.7309 18.5786 18.7483 17.8284 19.4984C17.0783 20.2486 16.0609 20.67 15 20.67H7C5.93913 20.67 4.92172 20.2486 4.17157 19.4984C3.42143 18.7483 3 17.7309 3 16.67V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Take Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanProduct;

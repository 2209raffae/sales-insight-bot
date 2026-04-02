#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Installing frontend dependencies and building React app..."
cd frontend
# Clear old build artifacts
rm -rf dist
npm install
npm run build
# Diagnostic: check if build produced what we expect
echo "Checking frontend/dist contents:"
ls -la dist || echo "frontend/dist not found!"
ls -la dist/assets || echo "frontend/dist/assets not found!"
cd ..

echo "Build complete."

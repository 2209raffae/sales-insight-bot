#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Installing frontend dependencies and building React app..."
cd frontend
npm install
npm run build
cd ..

echo "Build complete."

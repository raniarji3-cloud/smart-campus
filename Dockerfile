FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential cmake libboost-all-dev libgtk-3-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt requirements.txt
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy all code
COPY . .

# Expose Hugging Face required port
EXPOSE 7860

# Start Flask server with Gunicorn
CMD ["gunicorn", "face_server:app", "--bind", "0.0.0.0:7860"]

# Build from base image
ARG BASE_IMAGE=ona-base:latest
FROM ${BASE_IMAGE}

# Copy service-specific requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and utils
COPY app.py ${LAMBDA_TASK_ROOT}/
COPY utils/ ${LAMBDA_TASK_ROOT}/utils/

# Set the CMD to your handler
CMD ["app.lambda_handler"]
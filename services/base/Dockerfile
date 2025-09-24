# Base image for ONA Platform services
FROM public.ecr.aws/lambda/python:3.9

# Install system dependencies
RUN yum update -y && \
    yum install -y \
    gcc \
    g++ \
    make \
    cmake \
    unzip \
    libcurl4-openssl-dev \
    && yum clean all

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy and install base Python dependencies
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements-base.txt

# Copy shared utilities
COPY utils/ ${LAMBDA_TASK_ROOT}/utils/

# Set Python path to include the task root
ENV PYTHONPATH="${LAMBDA_TASK_ROOT}:${PYTHONPATH}"

# Create directory for models
RUN mkdir -p ${LAMBDA_TASK_ROOT}/models

# Set common environment variables
ENV LOG_LEVEL=INFO
ENV PYTHONUNBUFFERED=1
# Use a lightweight nginx image
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory in container
WORKDIR /usr/share/nginx/html

# Copy all application files
COPY index.html ./
COPY app.js ./
COPY config.js ./
COPY manifest.json ./
COPY sw.js ./
COPY browserconfig.xml ./

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create icons directory (will be empty if no icons exist)
RUN mkdir -p icons

# Copy icons if they exist
COPY icons/ ./icons/ 2>/dev/null || true

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Create non-root user for security  
USER nginx

# Expose port 8080
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

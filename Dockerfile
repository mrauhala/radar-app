# Use a lightweight nginx image
FROM nginx:alpine

# Copy your HTML file into nginx's default site
COPY index.html /usr/share/nginx/html/index.html
COPY app.js /usr/share/nginx/html/app.js
COPY config.js /usr/share/nginx/html/config.js

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]


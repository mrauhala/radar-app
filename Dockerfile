# Use a lightweight nginx image
FROM nginx:alpine

# Copy your HTML file into nginx’s default site
COPY index.html /usr/share/nginx/html/index.html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]


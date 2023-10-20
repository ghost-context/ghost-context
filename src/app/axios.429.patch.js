const axios = require('axios');

export function PatchAxios() {
    // Save a reference to the original request method
    const originalRequest = axios.Axios.prototype.request;

    // Redefine the request method
    axios.Axios.prototype.request = async function(config) {
        try {
            // Try to execute the request
            return await originalRequest.call(this, config);
        } catch (error) {
            if (error.response && error.response.status === 429) {
            // If the response status is 429 (Too Many Requests), wait for a random delay and then try again
            const delay = Math.random() * 100; // Random delay between 0 and 100 m seconds
            await new Promise(resolve => setTimeout(resolve, delay));
            }
            throw error;
        }
    }
}
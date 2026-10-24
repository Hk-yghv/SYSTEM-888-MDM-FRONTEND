export const readApiResponse = async (response, fallbackMessage = 'The server request failed.') => {
    const responseText = await response.text();
    let data;

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        if (!response.ok) {
            const detail = response.status === 404
                ? 'The API endpoint was not found. Confirm the backend deployment includes this feature.'
                : `The server returned an unexpected response (HTTP ${response.status}).`;
            throw new Error(detail);
        }
        throw new Error('The server returned an invalid JSON response.');
    }

    if (!response.ok) throw new Error(data.error || fallbackMessage);
    return data;
};

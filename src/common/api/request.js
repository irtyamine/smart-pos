import axios from 'axios';
import get from 'lodash.get';

const baseURL = 'http://127.0.0.1:1337';
const apiBaseURL = `${baseURL}/api/v1/`;

const request = async (options) => {
  const rawResult = await axios({
    method: 'get',
    withCredentials: true,
    baseURL: apiBaseURL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    ...options
  });

  const status = get(rawResult, 'data.status', '');

  return status === 'success' ? get(rawResult, 'data.data', '') : '';
};

export { baseURL };
export default request;

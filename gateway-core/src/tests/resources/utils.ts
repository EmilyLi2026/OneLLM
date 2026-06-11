export const createDefaultHeaders = (
  provider: string,
  authorization: string
) => {
  return {
    'x-onellm-provider': provider,
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
};

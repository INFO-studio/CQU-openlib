import { createContext, useContext } from 'react';
/** Current doc directory for resolving relative markdown links/images. */
export const DocBaseContext = createContext('/');
export const useDocBase = () => {
  return useContext(DocBaseContext);
};

import '@testing-library/jest-dom';

// react-router-dom v7 uses TextEncoder/TextDecoder (Web APIs not polyfilled by jsdom)
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

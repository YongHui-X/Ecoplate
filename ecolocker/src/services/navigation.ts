import { storage } from "./storage";

export function getEcoPlateUrl(path: string = "/marketplace"): string {
  const token = storage.getToken();
  if (token) {
    return `${path}?token=${token}`;
  }
  return path;
}

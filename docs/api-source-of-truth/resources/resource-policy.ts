export function isHistoricalResource(resourceOfferingId: string, currentOfferingId: string) {
  return resourceOfferingId !== currentOfferingId;
}

export function metadataWindowOpen(editableUntil: Date, now: Date) {
  return now < editableUntil;
}

export function announcementShouldPush(priority: string) {
  return priority === 'IMPORTANT' || priority === 'URGENT';
}

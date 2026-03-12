import { AP_CONTEXT } from './activityTypes.js';
import type { APOrderedCollection, APOrderedCollectionPage, APActivity } from './activityTypes.js';

/** Generate an OrderedCollection for an actor's outbox */
export function generateOutboxCollection(
  totalItems: number,
  domain: string,
  username: string,
): APOrderedCollection {
  const baseUri = `https://${domain}/users/${username}/outbox`;
  return {
    '@context': AP_CONTEXT,
    type: 'OrderedCollection',
    id: baseUri,
    totalItems,
    first: `${baseUri}?page=1`,
    last: `${baseUri}?page=last`,
  };
}

/** Generate a page of an actor's outbox */
export function generateOutboxPage(
  activities: APActivity[],
  domain: string,
  username: string,
  page: number,
  pageSize: number,
  totalItems: number,
): APOrderedCollectionPage {
  const baseUri = `https://${domain}/users/${username}/outbox`;
  const totalPages = Math.ceil(totalItems / pageSize);

  const result: APOrderedCollectionPage = {
    '@context': AP_CONTEXT,
    type: 'OrderedCollectionPage',
    id: `${baseUri}?page=${page}`,
    partOf: baseUri,
    orderedItems: activities,
  };

  if (page < totalPages) {
    result.next = `${baseUri}?page=${page + 1}`;
  }
  if (page > 1) {
    result.prev = `${baseUri}?page=${page - 1}`;
  }

  return result;
}

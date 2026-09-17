import { useCallback, useEffect, useState } from 'react';
import { useAuth, useUser, useOrganization } from '@clerk/react';

const ID_PREFIX_PATTERN = /^(user_|org_|member_|session_|invitation_)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function getDisplayName(resource) {
  if (!resource) return '';
  if (typeof resource === 'string') return resource.trim();
  const name =
    resource.fullName ||
    resource.full_name ||
    resource.name ||
    [resource.firstName, resource.lastName].filter(Boolean).join(' ') ||
    [resource.first_name, resource.last_name].filter(Boolean).join(' ') ||
    resource.username ||
    resource.email ||
    resource.emailAddress ||
    resource.primaryEmailAddress?.emailAddress ||
    resource.emailAddresses?.find((entry) => entry.emailAddress)?.emailAddress ||
    resource.identifier;
  return String(name ?? '').trim();
}

export function isPersonId(value) {
  const text = String(value ?? '').trim();
  if (!text || text.includes('@') || /\s/.test(text)) return false;
  if (ID_PREFIX_PATTERN.test(text)) return true;
  if (UUID_PATTERN.test(text)) return true;
  if (OBJECT_ID_PATTERN.test(text)) return true;
  return text.length >= 20;
}

export function usePersonResolver() {
  const { userId } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const [orgMembers, setOrgMembers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!organization) {
      setOrgMembers([]);
      return undefined;
    }
    organization
      .getMemberships({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        const members = (res?.data || [])
          .map((membership) => {
            const publicUserData = membership?.publicUserData;
            return {
              id: publicUserData?.userId,
              name: getDisplayName(publicUserData),
              email: publicUserData?.identifier || publicUserData?.emailAddress || '',
            };
          })
          .filter((member) => member.id);
        setOrgMembers(members);
      })
      .catch(() => {
        if (!cancelled) setOrgMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [organization]);

  const resolvePerson = useCallback(
    (value) => {
      if (value && typeof value === 'object') {
        return getDisplayName(value) || value.id || value.userId || '';
      }
      const text = String(value ?? '').trim();
      if (!text) return '';
      if (userId && text === userId) {
        return (
          getDisplayName(user) ||
          user?.primaryEmailAddress?.emailAddress ||
          user?.emailAddresses?.find((entry) => entry.emailAddress)?.emailAddress ||
          text
        );
      }
      if (!isPersonId(text)) return text;
      const member = orgMembers.find((m) => m.id === text);
      return member ? member.name || member.email || text : text;
    },
    [userId, user, orgMembers]
  );

  return { resolvePerson, orgMembers, userId };
}
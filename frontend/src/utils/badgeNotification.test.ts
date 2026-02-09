import { describe, it, expect, vi } from 'vitest';
import { showBadgeToasts } from './badgeNotification';

describe('showBadgeToasts', () => {
  it('should not call addToast when no badges', () => {
    const addToast = vi.fn();
    showBadgeToasts({}, addToast);
    expect(addToast).not.toHaveBeenCalled();
  });

  it('should not call addToast when newBadges is undefined', () => {
    const addToast = vi.fn();
    showBadgeToasts({ newBadges: undefined }, addToast);
    expect(addToast).not.toHaveBeenCalled();
  });

  it('should not call addToast when newBadges is empty array', () => {
    const addToast = vi.fn();
    showBadgeToasts({ newBadges: [] }, addToast);
    expect(addToast).not.toHaveBeenCalled();
  });

  it('should call addToast for each badge', () => {
    const addToast = vi.fn();
    const response = {
      newBadges: [
        { name: 'First Steps', pointsAwarded: 25 },
        { name: 'Eco Starter', pointsAwarded: 50 },
      ],
    };

    showBadgeToasts(response, addToast);

    expect(addToast).toHaveBeenCalledTimes(2);
    expect(addToast).toHaveBeenCalledWith('Badge Earned: First Steps! +25 pts', 'success');
    expect(addToast).toHaveBeenCalledWith('Badge Earned: Eco Starter! +50 pts', 'success');
  });

  it('should format message correctly with badge name and points', () => {
    const addToast = vi.fn();
    const response = {
      newBadges: [{ name: 'Waste Warrior', pointsAwarded: 100 }],
    };

    showBadgeToasts(response, addToast);

    expect(addToast).toHaveBeenCalledWith('Badge Earned: Waste Warrior! +100 pts', 'success');
  });
});

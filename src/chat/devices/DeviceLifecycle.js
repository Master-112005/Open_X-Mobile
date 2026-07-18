/**
 * Mobile trusted device lifecycle helper.
 */
export class DeviceLifecycle {
  /**
   * Checks whether a device is trusted.
   * @param {object|null} device Device state.
   * @returns {boolean} Whether trusted.
   */
  isTrusted(device) {
    return Boolean(device && ['Approved', 'Active'].includes(device.deviceStatus) && device.approvalStatus === 'Approved');
  }
}

export default DeviceLifecycle;

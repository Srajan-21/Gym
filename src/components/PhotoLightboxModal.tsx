import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { getOptimizedPhotoUrl } from '../lib/cloudinary';
import { Colors } from '../theme/colors';
import { ProgressPhoto } from '../types/database';

interface PhotoLightboxModalProps {
  photo: ProgressPhoto | null;
  hidePose?: boolean;
  onClose: () => void;
}

export function PhotoLightboxModal({ photo, hidePose = false, onClose }: PhotoLightboxModalProps) {
  return (
    <Modal visible={Boolean(photo)} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.header}>
          <Text style={styles.meta}>
            {photo
              ? hidePose
                ? photo.log_date
                : `${photo.log_date} • ${photo.pose_tag.toUpperCase()}`
              : ''}
          </Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={22} color={Colors.text} />
          </Pressable>
        </View>
        {photo && (
          <Image
            source={{ uri: getOptimizedPhotoUrl(photo.cloudinary_url, 1200) }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    padding: 16,
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  meta: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '78%',
    borderRadius: 12,
  },
});

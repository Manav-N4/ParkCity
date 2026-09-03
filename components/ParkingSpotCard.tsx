import { Image, StyleSheet, Text, View } from "react-native";

import { colors, fontWeight, radius, spacing, typography } from '../constants/tokens';
import { ParkingSpot } from "../types/parking";

type parkingSpotCardProps = {
    spot: ParkingSpot;
};

export default function ParkingSpotCard({ spot }: parkingSpotCardProps) {
    return (
        <View style={styles.card}>
            <Image
                source={{ uri: spot.imageUrl }}
                style={styles.image}
                resizeMode="cover"
            />
            <View style={styles.content}>
                <Text style={styles.name}>{spot.name}</Text>

                <View style={styles.meta}>
                    <Text style={styles.distance}>{spot.distance}</Text>
                    <Text style={styles.price}>{spot.price}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },

    image: {
        width: '100%',
        height: 160,
    },

    content: {
        padding: spacing.md,
    },

    name: {
        color: colors.text,
        fontSize: typography.body,
        lineHeight: typography.bodyLineHeight,
        fontWeight: fontWeight.semibold,
        marginBottom: spacing.sm,
    },

    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    distance: {
        color: colors.textSecondary,
        fontSize: typography.small,
        lineHeight: typography.smallLineHeight,
    },

    price: {
        color: colors.text,
        fontSize: typography.small,
        lineHeight: typography.smallLineHeight,
        fontWeight: fontWeight.semibold,
    },

});
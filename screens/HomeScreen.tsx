import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import ParkingSpotCard from '../components/ParkingSpotCard';
import { colors, fontWeight, radius, size, spacing, typography } from '../constants/tokens';
import { mockParkingSpots } from '../lib/mockData';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Where are you going?</Text>

            <TextInput 
                style={styles.searchInput}
                placeholder="Search a destination"
                placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.sectionTitle}>Nearby parking</Text>

            <FlatList
                data={mockParkingSpots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ParkingSpotCard spot={item} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.md,
    },

    heading: {
        color: colors.text,
        fontSize: typography.heading,
        lineHeight: typography.headingLineHeight,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.md,
    },

    searchInput: {
        height: size.inputHeight,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        color: colors.text,
        fontSize: typography.body,
        marginBottom: spacing.xl,
    },

    sectionTitle: {
        color: colors.text,
        fontSize: typography.body,
        lineHeight: typography.bodyLineHeight,
        fontWeight: fontWeight.semibold,
        marginBottom: spacing.md,
    },

    listContent: {
        paddingBottom: spacing.xl,
    },
});
import { Trash2, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface NotePopupProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    noteText: string;
    onSave?: (newText: string) => void;
    onDelete?: () => void;
}

export default function NotePopup({ visible, onClose, title, noteText, onSave, onDelete }: NotePopupProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(noteText);

    useEffect(() => {
        if (visible) {
            setEditedText(noteText);
            setIsEditing(false);
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, noteText, scaleAnim, opacityAnim]);

    const handleSave = () => {
        if (onSave) onSave(editedText);
        setIsEditing(false);
        onClose();
    };

    const handleDelete = () => {
        if (onDelete) onDelete();
        onClose();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerTitleContainer}>
                                <Text style={styles.headerIcon}>{isEditing ? '✏️' : '📝'}</Text>
                                <Text style={styles.headerTitle} numberOfLines={1}>{isEditing ? 'Edit Note' : (title || 'My Note')}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <View style={styles.content}>
                            {isEditing ? (
                                <TextInput
                                    style={styles.textInput}
                                    multiline
                                    value={editedText}
                                    onChangeText={setEditedText}
                                    placeholder="Type your note here..."
                                    placeholderTextColor="#64748b"
                                    autoFocus
                                />
                            ) : (
                                <Text style={styles.noteText}>{noteText || 'No description provided.'}</Text>
                            )}
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            {isEditing ? (
                                <>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={() => setIsEditing(false)}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.okBtn} onPress={handleSave}>
                                        <Text style={styles.okBtnText}>Save</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.deleteBtn}
                                        onPress={handleDelete}
                                    >
                                        <Trash2 size={18} color="#f87171" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.editBtn}
                                        onPress={() => setIsEditing(true)}
                                    >
                                        <Text style={styles.editBtnText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.okBtn} onPress={onClose}>
                                        <Text style={styles.okBtnText}>OK</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
    },
    card: {
        backgroundColor: '#1e1e2e',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a3a',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        padding: 20,
        minHeight: 120,
        backgroundColor: '#2a2a3a',
    },
    noteText: {
        color: '#ffffff',
        fontSize: 16,
        lineHeight: 24,
    },
    textInput: {
        color: '#ffffff',
        fontSize: 16,
        lineHeight: 24,
        textAlignVertical: 'top',
        minHeight: 100,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        alignItems: 'center',
    },
    deleteBtn: {
        padding: 12,
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBtn: {
        flex: 1,
        backgroundColor: '#2a2a3a',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    editBtnText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#2a2a3a',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
    },
    okBtn: {
        flex: 1,
        backgroundColor: '#5b4fc7',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    okBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});

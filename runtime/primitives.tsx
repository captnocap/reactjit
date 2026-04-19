const React: any = require('react');
export const Box: any = (props: any) => React.createElement('View', props, props.children);
export const Text: any = (props: any) => React.createElement('Text', props, props.children);
export const Pressable: any = (props: any) => React.createElement('Pressable', props, props.children);
export const ScrollView: any = (props: any) => React.createElement('ScrollView', props, props.children);
export const TextInput: any = (props: any) => React.createElement('TextInput', props, props.children);
export const TextArea: any = (props: any) => React.createElement('TextArea', props, props.children);
export const TextEditor: any = (props: any) => React.createElement('TextEditor', props, props.children);

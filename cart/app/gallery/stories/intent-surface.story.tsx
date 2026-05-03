import { defineGallerySection, defineGalleryStory } from '../types';
import { IntentSurface } from '../components/intent-surface/IntentSurface';
import { IntentTitle } from '../components/intent-surface/IntentTitle';
import { IntentText } from '../components/intent-surface/IntentText';
import { IntentCard } from '../components/intent-surface/IntentCard';
import { IntentRow } from '../components/intent-surface/IntentRow';
import { IntentCol } from '../components/intent-surface/IntentCol';
import { IntentList } from '../components/intent-surface/IntentList';
import { IntentBtn } from '../components/intent-surface/IntentBtn';
import { IntentForm, IntentField, IntentSubmit } from '../components/intent-surface/IntentForm';
import { IntentBadge } from '../components/intent-surface/IntentBadge';
import { IntentCode } from '../components/intent-surface/IntentCode';
import { IntentDivider } from '../components/intent-surface/IntentDivider';
import { IntentKbd } from '../components/intent-surface/IntentKbd';
import { IntentSpacer } from '../components/intent-surface/IntentSpacer';
import { parseIntent } from '@reactjit/runtime/intent/parser';

const log = (msg: string) => console.log('[intent-surface story]', msg);

const composedSample = `[<Col>
  <Title>Where to next?</Title>
  <Text>Three options for the next step on the SDK CLI.</Text>
  <Card>
    <Title>Option 1 — help.js</Title>
    <Text>Quick win, ~15 min, isolated.</Text>
    <Btn reply="let's start with help.js">Pick help.js</Btn>
  </Card>
  <Card>
    <Title>Option 2 — pack-sdk.js</Title>
    <Text>The actual SDK CLI builder. Bigger piece.</Text>
    <Btn reply="let's do pack-sdk">Pick pack-sdk</Btn>
  </Card>
  <Card>
    <Title>Option 3 — bootstrap script</Title>
    <Text>Needs option 2 done first.</Text>
    <Btn reply="let's do the bootstrap script">Pick bootstrap</Btn>
  </Card>
</Col>]`;

const mockupSample = `[<Col>
  <Row>
    <Title>chat-loom</Title>
    <Badge tone=success>online</Badge>
  </Row>
  <Text>Endpoint: 127.0.0.1:1234. Press <Kbd>Cmd+K</Kbd> to focus the input.</Text>
  <Divider />
  <Card>
    <Row>
      <Title>Last response</Title>
      <Badge tone=info>parsed</Badge>
    </Row>
    <Code lang=tsx>{"<Btn reply=\\"yes\\">Yes</Btn>"}</Code>
  </Card>
  <Spacer size=md />
  <Row>
    <Btn reply="reload">Reload</Btn>
    <Btn reply="show settings">Settings</Btn>
  </Row>
</Col>]`;

const formSample = `[<Col>
  <Title>Tell me about yourself</Title>
  <Form>
    <Field name="name" label="Your name" placeholder="Alice" />
    <Field name="role" label="What you do" placeholder="builder / designer / etc" />
    <Field name="goal" label="One thing you want to ship this week" />
    <Submit reply="FORM_SUBMITTED name={name} role={role} goal={goal}">Send</Submit>
  </Form>
</Col>]`;

export const intentSurfaceSection = defineGallerySection({
  id: 'intent-surface',
  title: 'Intent Chat Surface',
  group: { id: 'compositions', title: 'Compositions' },
  kind: 'top-level',
  stories: [
    defineGalleryStory({
      id: 'intent-surface/composed-choices',
      title: 'Composed — multi-choice surface',
      source: 'cart/component-gallery/components/intent-surface/IntentSurface.tsx',
      status: 'ready',
      tags: ['intent', 'chat-surface', 'choices'],
      variants: [
        {
          id: 'composed',
          name: 'Three options with Btn',
          render: () => <IntentSurface nodes={parseIntent(composedSample)} onAction={log} />,
        },
      ],
    }),

    defineGalleryStory({
      id: 'intent-surface/mockup-fidelity',
      title: 'Composed — visual-fidelity mockup',
      source: 'cart/component-gallery/components/intent-surface/IntentSurface.tsx',
      status: 'ready',
      tags: ['intent', 'chat-surface', 'mockup', 'badge', 'code', 'divider', 'kbd', 'spacer'],
      variants: [
        {
          id: 'mockup',
          name: 'Title + badge + code + kbd + divider',
          render: () => <IntentSurface nodes={parseIntent(mockupSample)} onAction={log} />,
        },
      ],
    }),

    defineGalleryStory({
      id: 'intent-surface/form-roundtrip',
      title: 'Composed — form with submit',
      source: 'cart/component-gallery/components/intent-surface/IntentForm.tsx',
      status: 'ready',
      tags: ['intent', 'chat-surface', 'form'],
      variants: [
        {
          id: 'form',
          name: 'Three-field form, template reply',
          render: () => <IntentSurface nodes={parseIntent(formSample)} onAction={log} />,
        },
      ],
    }),

    defineGalleryStory({
      id: 'intent-surface/atoms',
      title: 'Atoms — every tag in isolation',
      source: 'cart/component-gallery/components/intent-surface',
      status: 'ready',
      tags: ['intent', 'chat-surface', 'atoms'],
      variants: [
        {
          id: 'title',
          name: '<Title>',
          render: () => <IntentTitle>This is a Title</IntentTitle>,
        },
        {
          id: 'text',
          name: '<Text>',
          render: () => <IntentText>This is body text from the Text component.</IntentText>,
        },
        {
          id: 'card',
          name: '<Card>',
          render: () => (
            <IntentCard>
              <IntentTitle>Card title</IntentTitle>
              <IntentText>Cards group related content with padding and a border.</IntentText>
            </IntentCard>
          ),
        },
        {
          id: 'row',
          name: '<Row>',
          render: () => (
            <IntentRow>
              <IntentBtn reply="A" label="A" onAction={log} />
              <IntentBtn reply="B" label="B" onAction={log} />
              <IntentBtn reply="C" label="C" onAction={log} />
            </IntentRow>
          ),
        },
        {
          id: 'col',
          name: '<Col>',
          render: () => (
            <IntentCol>
              <IntentText>First</IntentText>
              <IntentText>Second</IntentText>
              <IntentText>Third</IntentText>
            </IntentCol>
          ),
        },
        {
          id: 'list',
          name: '<List>',
          render: () => <IntentList items={['build the parser', 'wire the cart', 'ship the surface']} />,
        },
        {
          id: 'btn',
          name: '<Btn>',
          render: () => <IntentBtn reply="picked the option" label="Pick this" onAction={log} />,
        },
        {
          id: 'form',
          name: '<Form> + <Field> + <Submit>',
          render: () => (
            <IntentForm onAction={log}>
              <IntentField name="name" label="Name" placeholder="Alice" />
              <IntentField name="goal" label="Goal" />
              <IntentSubmit replyTemplate="Submitted: name={name}, goal={goal}" label="Send" />
            </IntentForm>
          ),
        },
        {
          id: 'badge',
          name: '<Badge>',
          render: () => (
            <IntentRow>
              <IntentBadge tone="neutral">neutral</IntentBadge>
              <IntentBadge tone="success">success</IntentBadge>
              <IntentBadge tone="warning">warning</IntentBadge>
              <IntentBadge tone="error">error</IntentBadge>
              <IntentBadge tone="info">info</IntentBadge>
            </IntentRow>
          ),
        },
        {
          id: 'code',
          name: '<Code lang=...>',
          render: () => (
            <IntentCode lang="ts">{"const greet = (name: string) => `hello, ${name}`;"}</IntentCode>
          ),
        },
        {
          id: 'divider',
          name: '<Divider />',
          render: () => (
            <IntentCol>
              <IntentText>Above the line</IntentText>
              <IntentDivider />
              <IntentText>Below the line</IntentText>
            </IntentCol>
          ),
        },
        {
          id: 'kbd',
          name: '<Kbd>',
          render: () => (
            <IntentRow>
              <IntentText>Press</IntentText>
              <IntentKbd>Cmd+K</IntentKbd>
              <IntentText>to focus search.</IntentText>
            </IntentRow>
          ),
        },
        {
          id: 'spacer',
          name: '<Spacer size=md />',
          render: () => (
            <IntentCol>
              <IntentText>Above</IntentText>
              <IntentSpacer size="lg" />
              <IntentText>Below (lg gap)</IntentText>
            </IntentCol>
          ),
        },
      ],
    }),
  ],
});

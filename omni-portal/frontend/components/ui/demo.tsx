import React, { useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  ProgressCard,
  Input,
  Label,
  Badge,
  Progress,
  CircularProgress,
  Alert,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  Skeleton
} from './index'

export function UIComponentsDemo() {
  const [progress, setProgress] = useState(65)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Healthcare Portal UI Components</h1>

      {/* Buttons Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="achievement">Achievement</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Cards Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Standard Card</CardTitle>
              <CardDescription>This is a standard card component</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card content goes here. It can contain any React components.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>

          <ProgressCard progress={progress}>
            <CardHeader>
              <CardTitle>Progress Card</CardTitle>
              <CardDescription>Shows progress at the bottom</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card displays a progress indicator.</p>
              <Button 
                onClick={() => setProgress(prev => prev >= 100 ? 0 : prev + 10)}
                className="mt-2"
                size="sm"
              >
                Increase Progress
              </Button>
            </CardContent>
          </ProgressCard>
        </div>
      </section>

      {/* Form Inputs Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Form Inputs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="text-input" required>Text Input</Label>
            <Input id="text-input" placeholder="Enter text..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf-input">CPF Input</Label>
            <Input id="cpf-input" mask="cpf" placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-input">Phone Input</Label>
            <Input id="phone-input" mask="phone" placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-input">Date Input</Label>
            <Input id="date-input" mask="date" placeholder="00/00/0000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cep-input">CEP Input</Label>
            <Input id="cep-input" mask="cep" placeholder="00000-000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disabled-input">Disabled Input</Label>
            <Input id="disabled-input" disabled value="Disabled" />
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="achievement">Achievement</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
        </div>
      </section>

      {/* Progress Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Progress Indicators</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Linear Progress</h3>
            <Progress value={75} showLabel />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Circular Progress</h3>
            <div className="flex gap-4">
              <CircularProgress value={25} showLabel />
              <CircularProgress value={50} showLabel />
              <CircularProgress value={75} showLabel />
              <CircularProgress value={100} showLabel size={80} strokeWidth={6} />
            </div>
          </div>
        </div>
      </section>

      {/* Alerts Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Alerts</h2>
        <div className="space-y-2">
          <Alert>
            <AlertTitle>Default Alert</AlertTitle>
            <AlertDescription>This is a default alert message.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>Your profile has been updated successfully.</AlertDescription>
          </Alert>
          <Alert variant="error">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>There was a problem processing your request.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Your session will expire in 5 minutes.</AlertDescription>
          </Alert>
          <Alert variant="info">
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>New features have been added to the portal.</AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Modal Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Modal</h2>
        <Modal open={modalOpen} onOpenChange={setModalOpen}>
          <ModalTrigger asChild>
            <Button>Open Modal</Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Modal Title</ModalTitle>
              <ModalDescription>
                This is an accessible modal dialog component.
              </ModalDescription>
            </ModalHeader>
            <div className="py-4">
              <p>Modal content can include forms, information, or any other React components.</p>
            </div>
            <ModalFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </section>

      {/* Skeleton Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Loading Skeletons</h2>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-[100px]" />
          </CardFooter>
        </Card>
      </section>
    </div>
  )
}
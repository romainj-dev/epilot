'use client'

import { Button } from '@/components/ui/button/Button'
import styles from './UserPopover.module.scss'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover/Popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar/Avatar'
import { LogOut, User } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useUserState } from '@/components/features/user-state/UserStateProvider'
import { useState } from 'react'

export function UserPopover() {
  const { userState } = useUserState()
  const { score = 0, username, email } = userState ?? {}
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error(error)
      setIsLoggingOut(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={styles.avatarButton}>
          <Avatar className={styles.avatar}>
            <AvatarFallback className={styles.avatarFallback}>
              <User className={styles.avatarIcon} />
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={styles.popoverContent}>
        {userState && (
          <div>
            <div className={styles.userInfo}>
              <>
                <p className={styles.username}>{username}</p>
                <p className={styles.email}>{email}</p>
              </>
            </div>

            <div className={styles.statsBox}>
              <div className={styles.statsRow}>
                <span className={styles.statsLabel}>Current Score</span>
                <span className={styles.statsValue}>
                  {score >= 0 ? `+${score}` : score}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className={styles.logoutButton}
              onClick={handleLogout}
              isLoading={isLoggingOut}
              disabled={isLoggingOut}
            >
              <LogOut className={styles.logoutIcon} />
              Log out
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
